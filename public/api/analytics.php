<?php
declare(strict_types=1);

// Prevent stray PHP notices from corrupting JSON output
@ini_set('display_errors', '0');

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Tarneit@3029';
const TOKEN_SECRET = 'chakosh_tea_admin_secret_key_2026';
const TOKEN_TTL_SECONDS = 86400 * 7; // 7 days session

/**
 * Emits a JSON response and exits.
 */
function sendResponse(int $statusCode, array $payload): void
{
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Ensures restrictive access control files exist inside private data folder.
 */
function protectDataDir(string $dir): void
{
    $htaccess = $dir . '/.htaccess';
    if (!is_file($htaccess)) {
        $htaccessContent = <<<HTACCESS
<IfModule mod_authz_core.c>
  Require all denied
</IfModule>
<IfModule !mod_authz_core.c>
  Order allow,deny
  Deny from all
</IfModule>
Options -Indexes
HTACCESS;
        @file_put_contents($htaccess, $htaccessContent, LOCK_EX);
    }

    $index = $dir . '/index.php';
    if (!is_file($index)) {
        @file_put_contents($index, "<?php http_response_code(403); exit;\n", LOCK_EX);
    }
}

/**
 * Resolves local writable directory for storing analytics database.
 */
function getDataDir(): string
{
    $dir = __DIR__ . '/.data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    if (is_dir($dir) && is_writable($dir)) {
        protectDataDir($dir);
        return $dir;
    }

    $sys = rtrim(sys_get_temp_dir(), '/\\') . '/chakosh-analytics';
    if (!is_dir($sys)) {
        @mkdir($sys, 0750, true);
    }
    return $sys;
}

/**
 * Gets or initializes the PDO SQLite database connection and schema.
 */
function getDatabase(): PDO
{
    static $db = null;
    if ($db instanceof PDO) {
        return $db;
    }

    $dir = getDataDir();
    $dbPath = $dir . '/analytics.sqlite';

    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Optimize SQLite performance
    $db->exec('PRAGMA journal_mode = WAL;');
    $db->exec('PRAGMA synchronous = NORMAL;');

    // Schema definition
    $db->exec("
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            visitor_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            device_type TEXT NOT NULL DEFAULT 'mobile',
            metadata TEXT,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_events_type_time ON events(event_type, created_at);
        CREATE INDEX IF NOT EXISTS idx_events_visitor ON events(visitor_id);
        CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

        CREATE TABLE IF NOT EXISTS active_visitors (
            visitor_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            device_type TEXT NOT NULL DEFAULT 'mobile',
            current_stage TEXT NOT NULL DEFAULT 'welcome',
            last_seen INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_active_last_seen ON active_visitors(last_seen);
    ");

    return $db;
}

/**
 * Generates an HMAC-signed auth token for the admin.
 */
function generateToken(): string
{
    $time = time();
    $exp = $time + TOKEN_TTL_SECONDS;
    $random = bin2hex(random_bytes(16));
    $payload = base64_encode(json_encode(['user' => ADMIN_USER, 'exp' => $exp, 'nonce' => $random]));
    $sig = hash_hmac('sha256', $payload, TOKEN_SECRET);
    return $payload . '.' . $sig;
}

/**
 * Resolves JSON body from either php://input or php://stdin
 */
function getRequestBody(): array
{
    $raw = @file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        $raw = @file_get_contents('php://stdin');
    }
    if (empty($raw)) {
        return [];
    }
    $decoded = json_decode((string) $raw, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Resolves Authorization header across standard PHP, Apache, and fallback cookies.
 */
function getAuthorizationHeader(): ?string
{
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (is_array($headers)) {
            foreach ($headers as $key => $val) {
                if (strcasecmp($key, 'Authorization') === 0) {
                    return (string) $val;
                }
            }
        }
    }
    return $_COOKIE['chk_adm_token'] ?? null;
}

/**
 * Verifies that the request provides a valid admin token.
 */
function verifyAdminToken(): bool
{
    $authHeader = getAuthorizationHeader();
    if (!$authHeader) {
        return false;
    }

    $token = trim((string) preg_replace('/^Bearer\s+/i', '', $authHeader));
    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        return false;
    }

    [$payload, $sig] = $parts;
    $expectedSig = hash_hmac('sha256', $payload, TOKEN_SECRET);
    if (!hash_equals($expectedSig, $sig)) {
        return false;
    }

    $data = json_decode(base64_decode($payload), true);
    if (!is_array($data) || empty($data['user']) || empty($data['exp'])) {
        return false;
    }

    if ($data['user'] !== ADMIN_USER || $data['exp'] < time()) {
        return false;
    }

    return true;
}

/**
 * Determines device category from user agent.
 */
function detectDeviceType(string $ua): string
{
    if (preg_match('/ipad|tablet|(android(?!.*mobile))/i', $ua)) {
        return 'tablet';
    }
    if (preg_match('/mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i', $ua)) {
        return 'mobile';
    }
    return 'desktop';
}

// --------------------------------------------------------------------------
// Request Routing
// --------------------------------------------------------------------------
if (empty($_GET) && !empty($_SERVER['QUERY_STRING'])) {
    parse_str($_SERVER['QUERY_STRING'], $_GET);
}
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = strtolower(trim((string) ($_GET['action'] ?? '')));

if ($method === 'OPTIONS') {
    header('Allow: GET, POST, OPTIONS');
    http_response_code(204);
    exit;
}

// 1. ADMIN LOGIN
if ($action === 'login' && $method === 'POST') {
    $input = getRequestBody();
    $username = trim((string) ($input['username'] ?? ''));
    $password = (string) ($input['password'] ?? '');

    if ($username === ADMIN_USER && $password === ADMIN_PASS) {
        $token = generateToken();
        // Also set as HTTP cookie for convenience
        setcookie('chk_adm_token', $token, [
            'expires' => time() + TOKEN_TTL_SECONDS,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        sendResponse(200, [
            'success' => true,
            'token' => $token,
            'username' => ADMIN_USER,
            'expiresIn' => TOKEN_TTL_SECONDS,
        ]);
    } else {
        sendResponse(401, ['error' => 'ভুল ইউজারনেম বা পাসওয়ার্ড।']);
    }
}

// 2. ADMIN LOGOUT
if ($action === 'logout') {
    setcookie('chk_adm_token', '', ['expires' => time() - 3600, 'path' => '/']);
    sendResponse(200, ['success' => true]);
}

// 3. TRACK EVENT (Public - used by game visitors)
if ($action === 'track' && $method === 'POST') {
    $input = getRequestBody();

    $eventType = trim((string) ($input['event'] ?? ''));
    $visitorId = substr(trim((string) ($input['visitorId'] ?? '')), 0, 64);
    $sessionId = substr(trim((string) ($input['sessionId'] ?? '')), 0, 64);
    $stage = substr(trim((string) ($input['stage'] ?? 'welcome')), 0, 32);
    $metadata = isset($input['metadata']) && is_array($input['metadata']) ? json_encode($input['metadata']) : null;

    $allowedEvents = ['visit', 'play', 'complete', 'download', 'share_facebook', 'share_messenger'];
    if (!in_array($eventType, $allowedEvents, true) || $visitorId === '') {
        sendResponse(400, ['error' => 'Invalid event payload']);
    }

    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $deviceType = detectDeviceType($ua);
    $now = time();

    try {
        $db = getDatabase();

        // Insert event
        $stmt = $db->prepare('
            INSERT INTO events (event_type, visitor_id, session_id, device_type, metadata, created_at)
            VALUES (:event_type, :visitor_id, :session_id, :device_type, :metadata, :created_at)
        ');
        $stmt->execute([
            ':event_type' => $eventType,
            ':visitor_id' => $visitorId,
            ':session_id' => $sessionId ?: $visitorId,
            ':device_type' => $deviceType,
            ':metadata' => $metadata,
            ':created_at' => $now,
        ]);

        // Upsert active visitor heartbeat
        $activeStmt = $db->prepare('
            INSERT INTO active_visitors (visitor_id, session_id, device_type, current_stage, last_seen)
            VALUES (:visitor_id, :session_id, :device_type, :current_stage, :last_seen)
            ON CONFLICT(visitor_id) DO UPDATE SET
                session_id = excluded.session_id,
                device_type = excluded.device_type,
                current_stage = excluded.current_stage,
                last_seen = excluded.last_seen
        ');
        $activeStmt->execute([
            ':visitor_id' => $visitorId,
            ':session_id' => $sessionId ?: $visitorId,
            ':device_type' => $deviceType,
            ':current_stage' => $stage,
            ':last_seen' => $now,
        ]);

        sendResponse(200, ['success' => true]);
    } catch (Throwable $e) {
        sendResponse(500, ['error' => 'Database error']);
    }
}

// 4. HEARTBEAT FOR LIVE VISITORS (Public - called every 30s by active users)
if ($action === 'heartbeat' && $method === 'POST') {
    $input = getRequestBody();

    $visitorId = substr(trim((string) ($input['visitorId'] ?? '')), 0, 64);
    $sessionId = substr(trim((string) ($input['sessionId'] ?? '')), 0, 64);
    $stage = substr(trim((string) ($input['stage'] ?? 'welcome')), 0, 32);

    if ($visitorId === '') {
        sendResponse(400, ['error' => 'Missing visitorId']);
    }

    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $deviceType = detectDeviceType($ua);
    $now = time();

    try {
        $db = getDatabase();

        $stmt = $db->prepare('
            INSERT INTO active_visitors (visitor_id, session_id, device_type, current_stage, last_seen)
            VALUES (:visitor_id, :session_id, :device_type, :current_stage, :last_seen)
            ON CONFLICT(visitor_id) DO UPDATE SET
                session_id = excluded.session_id,
                device_type = excluded.device_type,
                current_stage = excluded.current_stage,
                last_seen = excluded.last_seen
        ');
        $stmt->execute([
            ':visitor_id' => $visitorId,
            ':session_id' => $sessionId ?: $visitorId,
            ':device_type' => $deviceType,
            ':current_stage' => $stage,
            ':last_seen' => $now,
        ]);

        // Sweep very old active visitors (> 5 minutes inactive)
        $cleanupTime = $now - 300;
        $db->exec("DELETE FROM active_visitors WHERE last_seen < {$cleanupTime}");

        sendResponse(200, ['success' => true]);
    } catch (Throwable $e) {
        sendResponse(500, ['error' => 'Heartbeat error']);
    }
}

// 5. STATS QUERY (Protected - requires admin auth token)
if ($action === 'stats') {
    if (!verifyAdminToken()) {
        sendResponse(401, ['error' => 'Unauthorized. Please sign in to the Admin Portal.']);
    }

    $range = strtolower(trim((string) ($_GET['range'] ?? '24h')));
    $now = time();

    // Compute range cutoffs: 1 hour, 6 hours, 12 hours, 24 hours, lifetime (all)
    $cutoff = 0;
    if ($range === '1h') {
        $cutoff = $now - 3600;
    } elseif ($range === '6h') {
        $cutoff = $now - (6 * 3600);
    } elseif ($range === '12h') {
        $cutoff = $now - (12 * 3600);
    } elseif ($range === '24h') {
        $cutoff = $now - (24 * 3600);
    } else {
        // 'all' / lifetime
        $cutoff = 0;
        $range = 'all';
    }

    try {
        $db = getDatabase();

        // 1. Live Visitors: active within the last 120 seconds (2 minutes)
        $liveCutoff = $now - 120;
        $liveStmt = $db->prepare('SELECT COUNT(*) as live FROM active_visitors WHERE last_seen >= :cutoff');
        $liveStmt->execute([':cutoff' => $liveCutoff]);
        $liveVisitors = (int) ($liveStmt->fetch()['live'] ?? 0);

        // 2. Aggregate Counts in the requested time range
        $timeCondition = $cutoff > 0 ? 'WHERE created_at >= :cutoff' : '';
        $params = $cutoff > 0 ? [':cutoff' => $cutoff] : [];

        // Breakdown by event_type
        $statsStmt = $db->prepare("
            SELECT event_type, COUNT(*) as cnt
            FROM events
            {$timeCondition}
            GROUP BY event_type
        ");
        $statsStmt->execute($params);
        $counts = [];
        while ($row = $statsStmt->fetch()) {
            $counts[$row['event_type']] = (int) $row['cnt'];
        }

        $totalVisits = $counts['visit'] ?? 0;
        $plays = $counts['play'] ?? 0;
        $completions = $counts['complete'] ?? 0;
        $downloads = $counts['download'] ?? 0;
        $sharesFacebook = $counts['share_facebook'] ?? 0;
        $sharesMessenger = $counts['share_messenger'] ?? 0;
        $totalShares = $sharesFacebook + $sharesMessenger;

        // 3. Unique Visitors (DISTINCT visitor_id who visited in range)
        $uniqueStmt = $db->prepare("
            SELECT COUNT(DISTINCT visitor_id) as uniq
            FROM events
            " . ($cutoff > 0 ? 'WHERE created_at >= :cutoff' : '') . "
        ");
        $uniqueStmt->execute($params);
        $uniqueVisitors = (int) ($uniqueStmt->fetch()['uniq'] ?? 0);

        // 4. Device Breakdown in range
        $deviceStmt = $db->prepare("
            SELECT device_type, COUNT(*) as cnt
            FROM events
            " . ($cutoff > 0 ? 'WHERE created_at >= :cutoff' : '') . "
            GROUP BY device_type
        ");
        $deviceStmt->execute($params);
        $deviceBreakdown = ['mobile' => 0, 'desktop' => 0, 'tablet' => 0];
        while ($row = $deviceStmt->fetch()) {
            $deviceBreakdown[$row['device_type']] = (int) $row['cnt'];
        }

        // 5. Recent 20 events for live activity stream
        $recentStmt = $db->prepare("
            SELECT event_type, device_type, created_at, metadata
            FROM events
            ORDER BY created_at DESC
            LIMIT 20
        ");
        $recentStmt->execute();
        $recentEvents = $recentStmt->fetchAll();

        // 6. Conversion metrics
        $playRate = $uniqueVisitors > 0 ? round(($plays / $uniqueVisitors) * 100, 1) : 0;
        $completionRate = $plays > 0 ? round(($completions / $plays) * 100, 1) : 0;
        $downloadRate = $completions > 0 ? round(($downloads / $completions) * 100, 1) : 0;
        $shareRate = $completions > 0 ? round(($totalShares / $completions) * 100, 1) : 0;

        sendResponse(200, [
            'success' => true,
            'range' => $range,
            'serverTime' => $now,
            'liveVisitors' => $liveVisitors,
            'totalVisits' => $totalVisits,
            'uniqueVisitors' => $uniqueVisitors,
            'plays' => $plays,
            'completions' => $completions,
            'downloads' => $downloads,
            'sharesFacebook' => $sharesFacebook,
            'sharesMessenger' => $sharesMessenger,
            'totalShares' => $totalShares,
            'conversionRates' => [
                'playRate' => $playRate,
                'completionRate' => $completionRate,
                'downloadRate' => $downloadRate,
                'shareRate' => $shareRate,
            ],
            'deviceBreakdown' => $deviceBreakdown,
            'recentEvents' => $recentEvents,
        ]);
    } catch (Throwable $e) {
        sendResponse(500, ['error' => 'Stats computation error: ' . $e->getMessage()]);
    }
}

sendResponse(400, ['error' => 'Unknown action or method']);
