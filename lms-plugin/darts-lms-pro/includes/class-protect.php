<?php
/**
 * Content protection on lesson pages: watermark, no right-click, no easy copy.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Protection.
 */
class DLMS_Protect {

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'wp_head', array( __CLASS__, 'output' ), 1 );
		add_filter( 'body_class', array( __CLASS__, 'body_class' ) );
	}

	/**
	 * Should protection run on this page for this user.
	 */
	public static function active() {
		if ( ! dlms_opt( 'protect_enabled' ) || ! is_user_logged_in() || ! function_exists( 'tutor' ) ) {
			return false;
		}
		if ( ! is_singular( array( dlms_lesson_pt(), 'tutor_quiz', 'tutor_assignments' ) ) ) {
			return false;
		}
		return ! dlms_can_manage_course( dlms_lesson_course( get_queried_object_id() ) );
	}

	/**
	 * Body class.
	 *
	 * @param array $c Classes.
	 */
	public static function body_class( $c ) {
		if ( self::active() ) {
			$c[] = 'dlms-protected';
		}
		return $c;
	}

	/**
	 * Watermark text + config for JS.
	 */
	public static function output() {
		if ( ! self::active() ) {
			return;
		}
		$uid   = get_current_user_id();
		$phone = dlms_user_phone( $uid );
		$mark  = dlms_user_name( $uid ) . ( $phone ? ' · ' . $phone : '' );
		$cfg   = array(
			'watermark' => dlms_opt( 'watermark_enabled' ) ? $mark : '',
		);
		echo '<script>window.DLMS_PROTECT=' . wp_json_encode( $cfg ) . ';</script>';
	}
}
