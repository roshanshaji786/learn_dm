<?php
/**
 * PDF certificates with a public verify page.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Certificates.
 */
class DLMS_Certificates {

	/**
	 * Init (runs even without Tutor so verify links keep working).
	 */
	public static function init() {
		add_shortcode( 'dlms_verify', array( __CLASS__, 'verify_shortcode' ) );
		add_action( 'admin_post_dlms_certificate', array( __CLASS__, 'handle_download' ) );
		add_action( 'admin_post_nopriv_dlms_certificate', array( __CLASS__, 'handle_download' ) );
		add_action( 'admin_post_dlms_issue_certificate', array( __CLASS__, 'handle_issue' ) );
		add_action( 'admin_post_dlms_revoke_certificate', array( __CLASS__, 'handle_revoke' ) );
		add_action( 'tutor_course_complete_after', array( __CLASS__, 'on_course_complete' ), 20, 2 );
	}

	/**
	 * Does the student meet the attendance rule.
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 */
	public static function meets_attendance( $course_id, $user_id ) {
		$min = (int) dlms_meta( $course_id, 'cert_min_attend' );
		if ( ! $min ) {
			return true;
		}
		return DLMS_Reports::attendance_pct( $course_id, $user_id ) >= $min;
	}

	/**
	 * Auto-issue on course completion.
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 */
	public static function on_course_complete( $course_id, $user_id ) {
		if ( dlms_meta( $course_id, 'cert_off' ) || ! self::meets_attendance( $course_id, $user_id ) ) {
			return;
		}
		self::issue( $user_id, $course_id );
	}

	/**
	 * Issue (idempotent).
	 *
	 * @param int $user_id   User.
	 * @param int $course_id Course.
	 * @return object Certificate row.
	 */
	public static function issue( $user_id, $course_id ) {
		$existing = DLMS_DB::certificate_for( $user_id, $course_id );
		if ( $existing ) {
			if ( $existing->revoked ) {
				global $wpdb;
				$wpdb->update( DLMS_DB::t( 'certificates' ), array( 'revoked' => 0 ), array( 'id' => $existing->id ) );
				$existing->revoked = 0;
			}
			return $existing;
		}
		global $wpdb;
		do {
			$code = strtoupper( sanitize_key( dlms_opt( 'receipt_prefix' ) ) ) . '-' . wp_date( 'y' ) . '-' . strtoupper( wp_generate_password( 6, false, false ) );
		} while ( DLMS_DB::certificate( $code ) );
		$wpdb->insert(
			DLMS_DB::t( 'certificates' ),
			array(
				'code'         => $code,
				'user_id'      => $user_id,
				'course_id'    => $course_id,
				'student_name' => dlms_user_name( $user_id ),
				'course_name'  => get_the_title( $course_id ),
				'issued_at'    => current_time( 'mysql' ),
			)
		);
		$cert = DLMS_DB::certificate( $code );
		DLMS_Notify::certificate( $cert );
		return $cert;
	}

	/**
	 * Verify page URL.
	 *
	 * @param string $code Code.
	 */
	public static function verify_url( $code = '' ) {
		$page = (int) get_option( 'dlms_verify_page' );
		$url  = $page ? get_permalink( $page ) : home_url( '/verify-certificate/' );
		return $code ? add_query_arg( 'id', rawurlencode( $code ), $url ) : $url;
	}

	/**
	 * Download URL.
	 *
	 * @param string $code Code.
	 */
	public static function download_url( $code ) {
		return add_query_arg(
			array(
				'action' => 'dlms_certificate',
				'code'   => rawurlencode( $code ),
			),
			admin_url( 'admin-post.php' )
		);
	}

	/**
	 * Certificate HTML (A4 landscape).
	 *
	 * @param object $c Row.
	 */
	public static function html( $c ) {
		$color  = esc_attr( dlms_opt( 'brand_color' ) );
		$logo   = dlms_logo_data_uri();
		$hours  = '';
		$course = get_post( $c->course_id );
		$dur    = $course ? get_post_meta( $c->course_id, '_course_duration', true ) : '';
		if ( is_array( $dur ) && ( ! empty( $dur['hours'] ) || ! empty( $dur['minutes'] ) ) ) {
			$hours = (int) $dur['hours'] . ' hours';
		}
		$verify = self::verify_url( $c->code );
		ob_start();
		?>
<html><head><meta charset="utf-8"><style>
@page{margin:0}
body{margin:0;font-family:"DejaVu Sans",sans-serif;color:#1f2937}
.page{position:relative;width:297mm;height:209mm}
.frame{position:absolute;top:10mm;left:10mm;right:10mm;bottom:10mm;border:3px solid <?php echo $color; // phpcs:ignore ?>;}
.inner{position:absolute;top:14mm;left:14mm;right:14mm;bottom:14mm;border:1px solid #ddd6fe;text-align:center}
.band{position:absolute;top:0;left:0;right:0;height:9mm;background:<?php echo $color; // phpcs:ignore ?>}
.logo{margin-top:20mm;height:18mm}
.academy{margin-top:20mm;font-size:22px;font-weight:bold;color:<?php echo $color; // phpcs:ignore ?>;letter-spacing:1px}
.title{font-size:40px;letter-spacing:6px;margin-top:8mm;font-family:"DejaVu Serif",serif;color:#111827}
.sub{font-size:13px;color:#6b7280;letter-spacing:3px;margin-top:2mm}
.name{font-size:34px;font-weight:bold;margin-top:10mm;font-family:"DejaVu Serif",serif;color:<?php echo $color; // phpcs:ignore ?>}
.line{width:140mm;margin:2mm auto 0;border-top:1px solid #c4b5fd}
.course{font-size:15px;margin-top:6mm;color:#374151}
.course strong{font-size:19px;color:#111827}
.foot{position:absolute;top:150mm;left:12mm;right:12mm}
.foot table{width:100%;border-collapse:collapse}
.foot td{vertical-align:bottom;font-size:11px;color:#4b5563}
.sig{border-top:1px solid #9ca3af;padding-top:2mm;width:65mm;text-align:center}
.code{font-size:10px;color:#6b7280;text-align:right}
</style></head><body><div class="page"><div class="frame"></div><div class="inner"><div class="band"></div>
		<?php if ( $logo ) : ?>
<img class="logo" src="<?php echo $logo; // phpcs:ignore ?>">
<?php else : ?>
<div class="academy"><?php echo esc_html( dlms_opt( 'academy_name' ) ); ?></div>
<?php endif; ?>
<div class="title">CERTIFICATE</div>
<div class="sub">OF COMPLETION</div>
<div class="course" style="margin-top:9mm">This is to certify that</div>
<div class="name"><?php echo esc_html( $c->student_name ); ?></div>
<div class="line"></div>
<div class="course">has successfully completed<br><strong><?php echo esc_html( $c->course_name ); ?></strong><?php echo $hours ? '<br><span style="font-size:12px;color:#6b7280">' . esc_html( $hours ) . '</span>' : ''; ?></div>
<div class="foot"><table><tr>
<td width="33%"><div class="sig"><strong><?php echo esc_html( dlms_opt( 'signatory_name' ) ); ?></strong><br><?php echo esc_html( dlms_opt( 'signatory_title' ) ); ?></div></td>
<td width="34%" style="text-align:center">Issued on <?php echo esc_html( mysql2date( 'j F Y', $c->issued_at ) ); ?></td>
<td width="33%" class="code">Certificate ID: <strong><?php echo esc_html( $c->code ); ?></strong><br>Verify at <?php echo esc_html( preg_replace( '~^https?://~', '', self::verify_url() ) ); ?></td>
</tr></table></div>
</div></div></body></html>
		<?php
		return ob_get_clean();
	}

	/**
	 * Download handler: owner, manager, or anyone with the code (shareable like LinkedIn).
	 */
	public static function handle_download() {
		$code = sanitize_text_field( wp_unslash( $_GET['code'] ?? '' ) );
		$c    = DLMS_DB::certificate( $code );
		if ( ! $c || $c->revoked ) {
			wp_die( esc_html( dlms_t( 'Certificate not found' ) ), 404 );
		}
		dlms_send_pdf( dlms_pdf( self::html( $c ), 'landscape' ), 'Certificate-' . $c->code . '.pdf' );
	}

	/**
	 * Manual issue (admin).
	 */
	public static function handle_issue() {
		check_admin_referer( 'dlms_issue_certificate' );
		$course_id = absint( $_POST['course_id'] ?? 0 );
		$user_id   = absint( $_POST['user_id'] ?? 0 );
		if ( ! dlms_can_manage_course( $course_id ) || ! $user_id ) {
			wp_die( 'Not allowed', 403 );
		}
		$c = self::issue( $user_id, $course_id );
		DLMS_Payments::back( 'dlms-certificates', 'Certificate ' . $c->code . ' issued to ' . $c->student_name . '.' );
	}

	/**
	 * Revoke / restore (admin).
	 */
	public static function handle_revoke() {
		check_admin_referer( 'dlms_revoke_certificate' );
		$c = DLMS_DB::certificate( sanitize_text_field( wp_unslash( $_GET['code'] ?? '' ) ) );
		if ( ! $c || ! dlms_can_manage_course( $c->course_id ) ) {
			wp_die( 'Not allowed', 403 );
		}
		global $wpdb;
		$wpdb->update( DLMS_DB::t( 'certificates' ), array( 'revoked' => $c->revoked ? 0 : 1 ), array( 'id' => $c->id ) );
		DLMS_Payments::back( 'dlms-certificates', 'Certificate ' . $c->code . ( $c->revoked ? ' restored.' : ' revoked.' ) );
	}

	/**
	 * [dlms_verify] shortcode.
	 */
	public static function verify_shortcode() {
		$code = isset( $_GET['id'] ) ? strtoupper( sanitize_text_field( wp_unslash( $_GET['id'] ) ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$h    = '<div class="dlms-verify">';
		$h   .= '<form method="get" class="dlms-form dlms-inline"><label class="screen-reader-text" for="dlms-cert-id">' . esc_html( dlms_t( 'Enter certificate ID' ) ) . '</label><input type="text" id="dlms-cert-id" name="id" value="' . esc_attr( $code ) . '" placeholder="' . esc_attr( dlms_t( 'Enter certificate ID' ) ) . '" required><button class="dlms-btn" type="submit">' . esc_html( dlms_t( 'Verify' ) ) . '</button></form>';
		if ( $code ) {
			$c = DLMS_DB::certificate( $code );
			if ( $c && ! $c->revoked ) {
				$h .= '<div class="dlms-card dlms-valid"><p class="dlms-ok"><strong>✔ ' . esc_html( dlms_t( 'Certificate is valid' ) ) . '</strong></p><table class="dlms-table">'
					. '<tr><th>' . esc_html( dlms_t( 'Issued to' ) ) . '</th><td>' . esc_html( $c->student_name ) . '</td></tr>'
					. '<tr><th>' . esc_html( dlms_t( 'Course' ) ) . '</th><td>' . esc_html( $c->course_name ) . '</td></tr>'
					. '<tr><th>' . esc_html( dlms_t( 'Issued on' ) ) . '</th><td>' . esc_html( mysql2date( 'j F Y', $c->issued_at ) ) . '</td></tr>'
					. '<tr><th>' . esc_html( dlms_t( 'Certificate ID' ) ) . '</th><td>' . esc_html( $c->code ) . '</td></tr>'
					. '</table><p><a class="dlms-btn" href="' . esc_url( self::download_url( $c->code ) ) . '">' . esc_html( dlms_t( 'Download' ) ) . ' PDF</a></p></div>';
			} elseif ( $c ) {
				$h .= '<div class="dlms-card"><p class="dlms-err">' . esc_html( dlms_t( 'This certificate has been revoked.' ) ) . '</p></div>';
			} else {
				$h .= '<div class="dlms-card"><p class="dlms-err">' . esc_html( dlms_t( 'Certificate not found' ) ) . '</p></div>';
			}
		}
		return $h . '</div>';
	}
}
