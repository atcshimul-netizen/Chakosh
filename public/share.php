<?php
declare(strict_types=1);

$score = isset($_GET['score']) ? (int)$_GET['score'] : 0;
$score = max(0, min(100, $score));

// Bengali digits conversion
$bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
$bengaliScore = '';
foreach (str_split((string)$score) as $ch) {
    $bengaliScore .= $bengaliDigits[(int)$ch] ?? $ch;
}

$rawTitle = trim((string)($_GET['title'] ?? ''));
$rawDesc = trim((string)($_GET['desc'] ?? ''));
$rawName = trim((string)($_GET['name'] ?? ''));
$rawId = trim((string)($_GET['id'] ?? ''));
$imageId = (preg_match('/^[a-f0-9]{48}$/i', $rawId) === 1) ? strtolower($rawId) : '';

// Resolve Base URL dynamically
$isHttps = (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    ($_SERVER['SERVER_PORT'] ?? 80) == 443 ||
    (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
);
$protocol = $isHttps ? 'https://' : 'http://';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
$baseUrl = $protocol . $host . $scriptDir;

// Absolute Image URL for Facebook/Messenger crawlers
if ($imageId !== '') {
    $ogImageUrl = $baseUrl . '/api/result-image.php?action=image&id=' . $imageId;
    $ogImageType = 'image/png';
} else {
    $ogImageUrl = $baseUrl . '/assets/aistudio/1_b616f2b0.jpg';
    $ogImageType = 'image/jpeg';
}

$titleText = $rawTitle !== '' ? $rawTitle : 'খাঁটি চা-খোর';
$namePrefix = $rawName !== '' ? $rawName . '-এর রেজাল্ট: ' : '';

$ogTitle = $namePrefix . 'আমি ১০০-তে ' . $bengaliScore . ' পেয়েছি! খেতাব: ' . $titleText;
$ogDescription = $rawDesc !== ''
    ? '"' . $rawDesc . '" — আপনি কত বড় চা-খোর? এখনই খেলে জেনে নিন!'
    : 'বাঙালির খাঁটি চা-প্রেম পরিমাপের মজার ব্যক্তিত্ব কুইজ। আপনি কত বড় চা-খোর? এখনই টেস্ট করে দেখুন!';

// Full share URL for canonical tag
$shareUrl = $baseUrl . '/share.php?' . http_build_query($_GET);

// Redirect URL for human visitors
$queryParams = $_GET;
$queryParams['result'] = '1';
$queryParams['auto_popup'] = '1';
$redirectUrl = $baseUrl . '/?' . http_build_query($queryParams);
?>
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title><?= htmlspecialchars($ogTitle, ENT_QUOTES, 'UTF-8') ?></title>
  <meta name="description" content="<?= htmlspecialchars($ogDescription, ENT_QUOTES, 'UTF-8') ?>">
  
  <!-- Open Graph / Facebook / Messenger -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="<?= htmlspecialchars($shareUrl, ENT_QUOTES, 'UTF-8') ?>">
  <meta property="og:title" content="<?= htmlspecialchars($ogTitle, ENT_QUOTES, 'UTF-8') ?>">
  <meta property="og:description" content="<?= htmlspecialchars($ogDescription, ENT_QUOTES, 'UTF-8') ?>">
  <meta property="og:image" content="<?= htmlspecialchars($ogImageUrl, ENT_QUOTES, 'UTF-8') ?>">
  <meta property="og:image:secure_url" content="<?= htmlspecialchars($ogImageUrl, ENT_QUOTES, 'UTF-8') ?>">
  <meta property="og:image:type" content="<?= $ogImageType ?>">
  <meta property="og:image:width" content="1080">
  <meta property="og:image:height" content="1350">
  <meta property="og:site_name" content="চা-খোর কল্যাণ সমিতি">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="<?= htmlspecialchars($ogTitle, ENT_QUOTES, 'UTF-8') ?>">
  <meta name="twitter:description" content="<?= htmlspecialchars($ogDescription, ENT_QUOTES, 'UTF-8') ?>">
  <meta name="twitter:image" content="<?= htmlspecialchars($ogImageUrl, ENT_QUOTES, 'UTF-8') ?>">
  
  <!-- Instant Redirect for Human Visitors -->
  <meta http-equiv="refresh" content="0;url=<?= htmlspecialchars($redirectUrl, ENT_QUOTES, 'UTF-8') ?>">
  <script>
    window.location.replace(<?= json_encode($redirectUrl) ?>);
  </script>
</head>
<body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #FAF7F2; color: #381B0E;">
  <p>ফলাফল লোড হচ্ছে...</p>
  <p><a href="<?= htmlspecialchars($redirectUrl, ENT_QUOTES, 'UTF-8') ?>">যদি স্বয়ংক্রিয়ভাবে রিডাইরেক্ট না হয় তবে এখানে ক্লিক করুন</a></p>
</body>
</html>
