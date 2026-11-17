<?php
declare(strict_types=1);

// Prevent stray PHP notices/warnings from corrupting JSON or binary PNG responses
@ini_set('display_errors', '0');

const EXPIRATION_SECONDS = 600; // 10 minutes TTL
const SWEEP_THROTTLE_SECONDS = 60;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB max
const PNG_SIGNATURE = "\x89PNG\r\n\x1a\n";
const ID_REGEX = '/^[a-f0-9]{48}$/i';
const RESULT_FILENAME = 'chakosh-result.png';

/**
 * Emits a JSON response and terminates execution.
 */
function sendJson(int $statusCode, array $payload): void
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
 * Ensures restrictive protection files exist inside local web-adjacent temp folder.
 */
function protectStorageDir(string $dir): void
{
    $htaccessPath = $dir . '/.htaccess';
    if (!is_file($htaccessPath)) {
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
        @file_put_contents($htaccessPath, $htaccessContent, LOCK_EX);
    }

    $indexPath = $dir . '/index.php';
    if (!is_file($indexPath)) {
        @file_put_contents($indexPath, "<?php\nhttp_response_code(403);\nexit;\n", LOCK_EX);
    }
}

/**
 * Resolves a writable temporary directory for holding prepared result PNGs.
 * Prefers local protected .temp-downloads, falling back to system temp directory.
 */
function resolveStorageDir(): string
{
    $localDir = __DIR__ . '/.temp-downloads';
    if (!is_dir($localDir)) {
        @mkdir($localDir, 0750, true);
    }
    if (is_dir($localDir) && is_writable($localDir)) {
        protectStorageDir($localDir);
        return $localDir;
    }

    $sysTemp = rtrim(sys_get_temp_dir(), '/\\') . '/chakosh-temp-downloads';
    if (!is_dir($sysTemp)) {
        @mkdir($sysTemp, 0750, true);
    }
    if (is_dir($sysTemp) && is_writable($sysTemp)) {
        return $sysTemp;
    }

    throw new RuntimeException('Temporary storage directory is not writable on the server.');
}

/**
 * Deletes any expired PNG files (>10 minutes old) from the storage directory.
 */
function sweepExpiredFiles(string $storageDir, bool $force = false): void
{
    $markerPath = $storageDir . '/.last-sweep';
    $now = time();

    if (!$force && is_file($markerPath)) {
        $lastSweep = @filemtime($markerPath);
        if ($lastSweep !== false && ($now - $lastSweep) < SWEEP_THROTTLE_SECONDS) {
            return;
        }
    }

    @touch($markerPath);

    $files = @glob($storageDir . '/*.png');
    if (!is_array($files)) {
        return;
    }

    foreach ($files as $file) {
        if (!is_file($file)) {
            continue;
        }
        $mtime = @filemtime($file);
        if ($mtime === false || ($now - $mtime) > EXPIRATION_SECONDS) {
            @unlink($file);
        }
    }
}

/**
 * Resolves the public URL path to this PHP script regardless of root or subdirectory hosting.
 */
function getScriptPublicPath(): string
{
    $scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    if ($scriptName !== '' && substr($scriptName, -4) === '.php') {
        return $scriptName;
    }

    $requestUri = $_SERVER['REQUEST_URI'] ?? '';
    $path = parse_url($requestUri, PHP_URL_PATH);
    if (is_string($path) && $path !== '') {
        if (preg_match('#^(.*?/api)/#', $path, $matches)) {
            return $matches[1] . '/result-image.php';
        }
    }

    return '/api/result-image.php';
}

/**
 * Validates that raw bytes represent a safe, genuine PNG image within size/dimension limits.
 */
function validatePngBinary(string $binary): void
{
    $len = strlen($binary);
    if ($len === 0) {
        throw new InvalidArgumentException('No image data received.');
    }
    if ($len > MAX_IMAGE_BYTES) {
        throw new InvalidArgumentException('Image size exceeds 15 MB limit.');
    }
    if ($len < 8 || substr($binary, 0, 8) !== PNG_SIGNATURE) {
        throw new InvalidArgumentException('Image is not a valid PNG format.');
    }

    if (function_exists('getimagesizefromstring')) {
        $info = @getimagesizefromstring($binary);
        if ($info === false) {
            throw new InvalidArgumentException('Corrupted or invalid PNG image data.');
        }
        $width = (int) ($info[0] ?? 0);
        $height = (int) ($info[1] ?? 0);
        $type = (int) ($info[2] ?? 0);
        if ($type !== IMAGETYPE_PNG || $width <= 0 || $height <= 0 || $width > 5000 || $height > 5000) {
            throw new InvalidArgumentException('Uploaded PNG dimensions or format are invalid.');
        }
    }
}

/**
 * Extracts PNG binary data from raw image/png body, JSON imageData payload, or multipart upload.
 */
function extractUploadBinary(): string
{
    if (isset($_FILES['image']['tmp_name']) && is_uploaded_file($_FILES['image']['tmp_name'])) {
        $fileBytes = @file_get_contents($_FILES['image']['tmp_name']);
        if (is_string($fileBytes) && $fileBytes !== '') {
            return $fileBytes;
        }
    }

    $raw = @file_get_contents('php://input');
    if (!is_string($raw) || $raw === '') {
        return '';
    }

    if (strlen($raw) >= 8 && substr($raw, 0, 8) === PNG_SIGNATURE) {
        return $raw;
    }

    $trimmed = ltrim($raw);
    if (strlen($trimmed) > 0 && $trimmed[0] === '{') {
        $decoded = json_decode($trimmed, true);
        if (is_array($decoded) && isset($decoded['imageData']) && is_string($decoded['imageData'])) {
            $base64 = preg_replace('/^data:image\/png;base64,/i', '', $decoded['imageData']);
            $binary = base64_decode((string) $base64, true);
            if (is_string($binary)) {
                return $binary;
            }
        }
    }

    return $raw;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'OPTIONS') {
    header('Allow: GET, POST, OPTIONS');
    http_response_code(204);
    exit;
}

if ($method === 'POST') {
    try {
        $storageDir = resolveStorageDir();
        sweepExpiredFiles($storageDir, true);

        $binary = extractUploadBinary();
        validatePngBinary($binary);

        $id = bin2hex(random_bytes(24)); // 48-character unguessable hex identifier
        $filePath = $storageDir . '/' . $id . '.png';

        $written = @file_put_contents($filePath, $binary, LOCK_EX);
        if ($written === false || $written !== strlen($binary)) {
            @unlink($filePath);
            throw new RuntimeException('Failed to write temporary image file.');
        }
        @chmod($filePath, 0640);

        $scriptPath = getScriptPublicPath();

        sendJson(200, [
            'success' => true,
            'id' => $id,
            'downloadUrl' => $scriptPath . '?action=download&id=' . $id,
            'imageUrl' => $scriptPath . '?action=image&id=' . $id,
            'filename' => RESULT_FILENAME,
            'expiresInMinutes' => 10,
            'backend' => 'php',
        ]);
    } catch (InvalidArgumentException $e) {
        sendJson(400, ['error' => $e->getMessage()]);
    } catch (Throwable $e) {
        sendJson(500, ['error' => 'Failed to store temporary image.']);
    }
}

if ($method === 'GET') {
    $action = strtolower(trim((string) ($_GET['action'] ?? 'image')));
    $rawId = trim((string) ($_GET['id'] ?? ''));

    if ($action !== 'image' && $action !== 'download') {
        sendJson(400, ['error' => 'Invalid action parameter.']);
    }

    if ($rawId === '' || preg_match(ID_REGEX, $rawId) !== 1) {
        sendJson(400, ['error' => 'Invalid image ID format.']);
    }

    $id = strtolower($rawId);

    try {
        $storageDir = resolveStorageDir();
    } catch (Throwable $e) {
        sendJson(500, ['error' => 'Temporary storage unavailable.']);
    }

    sweepExpiredFiles($storageDir, false);

    $filePath = $storageDir . '/' . $id . '.png';
    if (!is_file($filePath)) {
        sendJson(404, ['error' => 'Image not found']);
    }

    $mtime = @filemtime($filePath);
    if ($mtime === false || (time() - $mtime) > EXPIRATION_SECONDS) {
        @unlink($filePath);
        sendJson(410, [
            'error' => 'This download link has expired (10-minute limit).',
            'expired' => true,
        ]);
    }

    $size = @filesize($filePath);
    if ($size === false || $size <= 0) {
        sendJson(404, ['error' => 'Image not found']);
    }

    while (ob_get_level() > 0) {
        @ob_end_clean();
    }

    http_response_code(200);
    header('Content-Type: image/png');
    header(
        $action === 'download'
            ? 'Content-Disposition: attachment; filename="' . RESULT_FILENAME . '"'
            : 'Content-Disposition: inline; filename="' . RESULT_FILENAME . '"'
    );
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . $size);

    @readfile($filePath);
    exit;
}

sendJson(405, ['error' => 'Method not allowed']);
