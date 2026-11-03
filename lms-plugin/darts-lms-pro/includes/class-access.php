<?php
/**
 * Lesson locking: drip, sequential order, course prerequisites, overdue fees.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Access.
 */
class DLMS_Access {

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'template_redirect', array( __CLASS__, 'gate' ), 5 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'assets' ) );
	}

	/**
	 * Front assets (shared by all modules).
	 */
	public static function assets() {
		wp_enqueue_style( 'dlms-front', DLMS_URL . 'assets/front.css', array(), DLMS_VERSION );
		wp_add_inline_style( 'dlms-front', ':root{--dlms-brand:' . sanitize_hex_color( dlms_opt( 'brand_color' ) ) . '}' );
		wp_enqueue_script( 'dlms-front', DLMS_URL . 'assets/front.js', array(), DLMS_VERSION, true );
	}

	/**
	 * Enrolment start timestamp.
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 */
	public static function enrolled_ts( $course_id, $user_id ) {
		$e = dlms_get_enrolment( $course_id, $user_id );
		return $e ? (int) get_post_time( 'U', true, $e ) : 0;
	}

	/**
	 * When a lesson unlocks for a user by drip rules (0 = no drip).
	 *
	 * @param int $lesson_id Lesson.
	 * @param int $user_id   User.
	 */
	public static function unlock_ts( $lesson_id, $user_id ) {
		$mode = dlms_meta( $lesson_id, 'unlock_mode' );
		if ( 'date' === $mode && dlms_meta( $lesson_id, 'unlock_date' ) ) {
			return dlms_local_to_ts( dlms_meta( $lesson_id, 'unlock_date' ) . ' 00:00' );
		}
		if ( 'days' === $mode ) {
			$course = dlms_lesson_course( $lesson_id );
			$start  = self::enrolled_ts( $course, $user_id );
			if ( $start ) {
				$day0 = dlms_local_to_ts( wp_date( 'Y-m-d', $start ) . ' 00:00' );
				return $day0 + (int) dlms_meta( $lesson_id, 'unlock_days' ) * DAY_IN_SECONDS;
			}
		}
		if ( 'live' === $mode && dlms_meta( $lesson_id, 'live_start' ) ) {
			// Opens a little before the live class.
			return dlms_local_to_ts( dlms_meta( $lesson_id, 'live_start' ) ) - HOUR_IN_SECONDS;
		}
		return 0;
	}

	/**
	 * Why a lesson is locked for a user, or null if open.
	 *
	 * @param int $lesson_id Lesson.
	 * @param int $user_id   User.
	 * @return array|null ['type'=>..., 'message'=>..., 'html'=>...]
	 */
	public static function lock( $lesson_id, $user_id ) {
		$course_id = dlms_lesson_course( $lesson_id );
		if ( ! $course_id || ! $user_id || dlms_can_manage_course( $course_id, $user_id ) ) {
			return null;
		}
		if ( ! dlms_is_enrolled( $course_id, $user_id ) ) {
			return null; // Tutor handles non-enrolled access itself.
		}

		// Overdue fee.
		$fee = DLMS_DB::fee( $user_id, $course_id );
		if ( $fee && DLMS_DB::is_overdue( $fee ) ) {
			$bal  = DLMS_DB::balance( $fee );
			$msg  = sprintf( dlms_t( 'Your payment of %1$s was due on %2$s. Pay the balance to continue learning.' ), dlms_money( $bal ), mysql2date( 'j M Y', $fee->due_date ) );
			$html = '<p>' . esc_html( $msg ) . '</p>';
			if ( dlms_opt( 'upi_id' ) ) {
				$upi   = 'upi://pay?pa=' . rawurlencode( dlms_opt( 'upi_id' ) ) . '&pn=' . rawurlencode( dlms_opt( 'academy_name' ) ) . '&am=' . rawurlencode( (string) $bal ) . '&cu=INR&tn=' . rawurlencode( get_the_title( $course_id ) );
				$html .= '<p>' . esc_html( dlms_t( 'Pay by UPI to' ) ) . ' <strong>' . esc_html( dlms_opt( 'upi_id' ) ) . '</strong></p><p><a class="dlms-btn" href="' . esc_url( $upi, array( 'upi' ) ) . '">UPI · ' . esc_html( dlms_money( $bal ) ) . '</a></p>';
			}
			if ( dlms_opt( 'whatsapp' ) ) {
				$html .= '<p><a class="dlms-btn dlms-btn-wa" href="' . esc_url( dlms_wa_link( dlms_opt( 'whatsapp' ), 'Hi, I have paid ' . dlms_money( $bal ) . ' for ' . get_the_title( $course_id ) . '. Screenshot attached.' ) ) . '">' . esc_html( dlms_t( 'Send screenshot on WhatsApp' ) ) . '</a></p>';
			}
			return array(
				'type'    => 'fee',
				'message' => $msg,
				'html'    => $html,
			);
		}

		// Course prerequisites.
		$missing = DLMS_Courses::missing_prereqs( $course_id, $user_id );
		if ( $missing ) {
			$msg = sprintf( dlms_t( 'Complete these courses first: %s' ), implode( ', ', array_map( 'get_the_title', $missing ) ) );
			return array(
				'type'    => 'prereq',
				'message' => $msg,
				'html'    => '<p>' . esc_html( $msg ) . '</p>',
			);
		}

		// Drip.
		$unlock = self::unlock_ts( $lesson_id, $user_id );
		if ( $unlock && time() < $unlock ) {
			$msg = sprintf( dlms_t( 'Unlocks on %s.' ), dlms_date( $unlock, 'D, j M Y' ) );
			return array(
				'type'    => 'drip',
				'message' => $msg,
				'html'    => '<p>' . esc_html( $msg ) . '</p>',
				'unlock'  => $unlock,
			);
		}

		// Sequential.
		if ( dlms_meta( $course_id, 'sequential' ) ) {
			$prev = null;
			foreach ( dlms_course_lessons( $course_id ) as $l ) {
				if ( (int) $l->ID === (int) $lesson_id ) {
					break;
				}
				$prev = $l;
			}
			if ( $prev && ! tutor_utils()->is_completed_lesson( $prev->ID, $user_id ) && ! self::is_live_only( $prev->ID ) ) {
				$msg = sprintf( dlms_t( 'Finish "%s" first to unlock this lesson.' ), $prev->post_title );
				return array(
					'type'    => 'sequence',
					'message' => $msg,
					'html'    => '<p>' . esc_html( $msg ) . '</p><p><a class="dlms-btn" href="' . esc_url( get_permalink( $prev->ID ) ) . '">' . esc_html( $prev->post_title ) . '</a></p>',
				);
			}
		}
		return null;
	}

	/**
	 * A live-class lesson does not block the next one (students may miss a class).
	 *
	 * @param int $lesson_id Lesson.
	 */
	public static function is_live_only( $lesson_id ) {
		return (bool) dlms_meta( $lesson_id, 'live_start' );
	}

	/**
	 * Gate single lesson pages.
	 */
	public static function gate() {
		if ( ! is_singular( dlms_lesson_pt() ) || ! is_user_logged_in() ) {
			return;
		}
		$lesson_id = get_queried_object_id();
		$lock      = self::lock( $lesson_id, get_current_user_id() );
		if ( ! $lock ) {
			return;
		}
		$course_id = dlms_lesson_course( $lesson_id );
		status_header( 200 );
		nocache_headers();
		self::render_page(
			dlms_t( 'This lesson is locked' ),
			'<div class="dlms-lock dlms-lock-' . esc_attr( $lock['type'] ) . '"><div class="dlms-lock-icon" aria-hidden="true">🔒</div><h1>' . esc_html( get_the_title( $lesson_id ) ) . '</h1>' . $lock['html'] . '<p><a href="' . esc_url( get_permalink( $course_id ) ) . '">← ' . esc_html( dlms_t( 'Back to course' ) ) . '</a></p></div>'
		);
		exit;
	}

	/**
	 * Render a simple themed page.
	 *
	 * @param string $title Title.
	 * @param string $html  Body.
	 */
	public static function render_page( $title, $html ) {
		add_filter( 'pre_get_document_title', fn() => $title . ' – ' . get_bloginfo( 'name' ) );
		if ( wp_is_block_theme() ) {
			?><!doctype html><html <?php language_attributes(); ?>><head><meta charset="<?php bloginfo( 'charset' ); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head><body <?php body_class( 'dlms-page' ); ?>><?php wp_body_open(); ?><main class="dlms-page-main"><?php echo $html; // phpcs:ignore ?></main><?php wp_footer(); ?></body></html>
			<?php
			return;
		}
		get_header();
		echo '<main class="dlms-page-main">' . $html . '</main>'; // phpcs:ignore
		get_footer();
	}
}
