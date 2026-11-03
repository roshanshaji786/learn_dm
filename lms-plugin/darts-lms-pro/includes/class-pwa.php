<?php
/**
 * Installable app (PWA): manifest, service worker, offline page, icons.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * PWA.
 */
class DLMS_PWA {

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'rewrites' ) );
		add_filter( 'query_vars', fn( $v ) => array_merge( $v, array( 'dlms_pwa' ) ) );
		add_action( 'parse_request', array( __CLASS__, 'serve' ) );
		add_action( 'wp_head', array( __CLASS__, 'head' ), 2 );
		add_action( 'wp_footer', array( __CLASS__, 'register' ), 60 );
	}

	/**
	 * Rewrite rules for root-scoped files.
	 */
	public static function rewrites() {
		add_rewrite_rule( '^dlms-sw\.js$', 'index.php?dlms_pwa=sw', 'top' );
		add_rewrite_rule( '^dlms-manifest\.webmanifest$', 'index.php?dlms_pwa=manifest', 'top' );
		add_rewrite_rule( '^dlms-offline/?$', 'index.php?dlms_pwa=offline', 'top' );
		add_rewrite_rule( '^dlms-icon-(192|512)\.png$', 'index.php?dlms_pwa=icon$matches[1]', 'top' );
	}

	/**
	 * URL of a PWA file (works with plain permalinks too).
	 *
	 * @param string $what sw|manifest|offline|icon192|icon512.
	 */
	public static function url( $what ) {
		if ( get_option( 'permalink_structure' ) ) {
			$map = array(
				'sw'       => 'dlms-sw.js',
				'manifest' => 'dlms-manifest.webmanifest',
				'offline'  => 'dlms-offline/',
				'icon192'  => 'dlms-icon-192.png',
				'icon512'  => 'dlms-icon-512.png',
			);
			return home_url( '/' . $map[ $what ] );
		}
		return add_query_arg( 'dlms_pwa', $what, home_url( '/' ) );
	}

	/**
	 * Head tags.
	 */
	public static function head() {
		if ( ! dlms_opt( 'pwa_enabled' ) ) {
			return;
		}
		echo '<link rel="manifest" href="' . esc_url( self::url( 'manifest' ) ) . '">' . "\n";
		echo '<meta name="theme-color" content="' . esc_attr( dlms_opt( 'brand_color' ) ) . '">' . "\n";
		echo '<link rel="apple-touch-icon" href="' . esc_url( self::url( 'icon192' ) ) . '">' . "\n";
		echo '<meta name="apple-mobile-web-app-capable" content="yes">' . "\n";
	}

	/**
	 * Register the service worker + install button.
	 */
	public static function register() {
		if ( ! dlms_opt( 'pwa_enabled' ) ) {
			return;
		}
		$sw = self::url( 'sw' );
		echo '<button type="button" class="dlms-install" hidden>' . esc_html( dlms_t( 'Install app' ) ) . '</button>';
		echo "<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register(" . wp_json_encode( $sw ) . ",{scope:'/'}).catch(function(){});});}</script>";
	}

	/**
	 * Serve files.
	 *
	 * @param WP $wp Request.
	 */
	public static function serve( $wp ) {
		$what = $wp->query_vars['dlms_pwa'] ?? '';
		if ( ! $what ) {
			return;
		}
		switch ( $what ) {
			case 'manifest':
				header( 'Content-Type: application/manifest+json; charset=utf-8' );
				$name = dlms_opt( 'academy_name' );
				echo wp_json_encode(
					array(
						'name'             => $name,
						'short_name'       => mb_substr( $name, 0, 12 ),
						'start_url'        => add_query_arg( 'source', 'pwa', wp_make_link_relative( dlms_hub_url() ) ),
						'scope'            => '/',
						'display'          => 'standalone',
						'background_color' => '#ffffff',
						'theme_color'      => dlms_opt( 'brand_color' ),
						'icons'            => array(
							array(
								'src'     => self::url( 'icon192' ),
								'sizes'   => '192x192',
								'type'    => 'image/png',
								'purpose' => 'any maskable',
							),
							array(
								'src'     => self::url( 'icon512' ),
								'sizes'   => '512x512',
								'type'    => 'image/png',
								'purpose' => 'any maskable',
							),
						),
					)
				);
				exit;
			case 'sw':
				header( 'Content-Type: application/javascript; charset=utf-8' );
				header( 'Service-Worker-Allowed: /' );
				header( 'Cache-Control: no-cache' );
				$offline = self::url( 'offline' );
				$v       = DLMS_VERSION;
				// Network first for pages; offline page when there is no connection. Never caches wp-admin or POSTs.
				echo "const C='dlms-$v';const OFF=" . wp_json_encode( $offline ) . ";\n";
				echo "self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.add(OFF)));self.skipWaiting();});\n";
				echo "self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim();});\n";
				echo "self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||r.url.includes('/wp-admin')||r.url.includes('wp-login'))return;if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match(OFF)));return;}if(/\\.(css|js|woff2?|png|jpg|jpeg|svg|webp)(\\?|$)/.test(r.url)&&new URL(r.url).origin===location.origin){e.respondWith(caches.open(C).then(c=>c.match(r).then(m=>{const f=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res;}).catch(()=>m);return m||f;})));}});\n";
				exit;
			case 'offline':
				header( 'Content-Type: text/html; charset=utf-8' );
				echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . esc_html( dlms_t( 'You are offline' ) ) . '</title><style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f5f3ff;color:#1f2937;text-align:center;padding:16px}h1{color:' . esc_attr( dlms_opt( 'brand_color' ) ) . '}</style></head><body><div><h1>' . esc_html( dlms_t( 'You are offline' ) ) . '</h1><p>' . esc_html( dlms_t( 'Check your internet connection and try again.' ) ) . '</p><p><button onclick="location.reload()">↻</button></p></div></body></html>';
				exit;
			case 'icon192':
			case 'icon512':
				self::icon( 'icon512' === $what ? 512 : 192 );
				exit;
		}
	}

	/**
	 * App icon: the logo if it is a square-ish image, else initials on the brand colour.
	 *
	 * @param int $size Size.
	 */
	public static function icon( $size ) {
		$up    = wp_upload_dir();
		$cache = trailingslashit( $up['basedir'] ) . 'dlms-icon-' . $size . '-' . md5( dlms_opt( 'logo_url' ) . dlms_opt( 'brand_color' ) . dlms_opt( 'academy_name' ) ) . '.png';
		if ( ! file_exists( $cache ) && function_exists( 'imagecreatetruecolor' ) ) {
			$im  = imagecreatetruecolor( $size, $size );
			$hex = ltrim( (string) dlms_opt( 'brand_color' ), '#' );
			$hex = 6 === strlen( $hex ) ? $hex : '6d28d9';
			$bg  = imagecolorallocate( $im, hexdec( substr( $hex, 0, 2 ) ), hexdec( substr( $hex, 2, 2 ) ), hexdec( substr( $hex, 4, 2 ) ) );
			imagefilledrectangle( $im, 0, 0, $size, $size, $bg );
			$placed = false;
			$logo   = dlms_opt( 'logo_url' );
			if ( $logo && 0 === strpos( $logo, $up['baseurl'] ) ) {
				$path = $up['basedir'] . substr( $logo, strlen( $up['baseurl'] ) );
				$src  = file_exists( $path ) ? @imagecreatefromstring( file_get_contents( $path ) ) : false; // phpcs:ignore
				if ( $src ) {
					$white = imagecolorallocate( $im, 255, 255, 255 );
					imagefilledrectangle( $im, 0, 0, $size, $size, $white );
					$w   = imagesx( $src );
					$h   = imagesy( $src );
					$box = (int) ( $size * 0.8 );
					$s   = min( $box / $w, $box / $h );
					$nw  = (int) ( $w * $s );
					$nh  = (int) ( $h * $s );
					imagecopyresampled( $im, $src, (int) ( ( $size - $nw ) / 2 ), (int) ( ( $size - $nh ) / 2 ), 0, 0, $nw, $nh, $w, $h );
					$placed = true;
				}
			}
			if ( ! $placed ) {
				$words    = preg_split( '/\s+/', trim( (string) dlms_opt( 'academy_name' ) ) );
				$initials = strtoupper( substr( $words[0] ?? 'D', 0, 1 ) . substr( $words[1] ?? 'A', 0, 1 ) );
				$white    = imagecolorallocate( $im, 255, 255, 255 );
				$font     = DLMS_DIR . 'vendor/dompdf/dompdf/lib/fonts/DejaVuSans-Bold.ttf';
				if ( function_exists( 'imagettftext' ) && file_exists( $font ) ) {
					$fs   = (int) ( $size * 0.36 );
					$bbox = imagettfbbox( $fs, 0, $font, $initials );
					$tw   = $bbox[2] - $bbox[0];
					$th   = $bbox[1] - $bbox[7];
					imagettftext( $im, $fs, 0, (int) ( ( $size - $tw ) / 2 - $bbox[0] ), (int) ( ( $size + $th ) / 2 - $bbox[1] ), $white, $font, $initials );
				} else {
					imagestring( $im, 5, (int) ( $size / 2 - 8 ), (int) ( $size / 2 - 8 ), $initials, $white );
				}
			}
			imagepng( $im, $cache );
			imagedestroy( $im );
		}
		header( 'Content-Type: image/png' );
		header( 'Cache-Control: public, max-age=604800' );
		if ( file_exists( $cache ) ) {
			readfile( $cache ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		}
	}
}
