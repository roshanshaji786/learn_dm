<?php
/**
 * Course and lesson settings, bundles, prerequisites and course credit.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Courses.
 */
class DLMS_Courses {

	/**
	 * Course meta keys (without _dlms_ prefix) and their sanitisers.
	 */
	public static function course_fields() {
		return array(
			'fee'             => 'float',
			'first_payment'   => 'float',
			'due_after_days'  => 'int',
			'sequential'      => 'bool',
			'prereq_courses'  => 'ids',
			'bundle_courses'  => 'ids',
			'credit_to'       => 'int',
			'cert_off'        => 'bool',
			'cert_min_attend' => 'int',
		);
	}

	/**
	 * Lesson meta keys.
	 */
	public static function lesson_fields() {
		return array(
			'live_start'       => 'datetime',
			'live_duration'    => 'int',
			'meet_link'        => 'url',
			'recording_url'    => 'url',
			'unlock_mode'      => 'key',
			'unlock_date'      => 'date',
			'unlock_days'      => 'int',
			'has_assignment'   => 'bool',
			'assign_text'      => 'html',
			'assign_max'       => 'float',
			'assign_due_days'  => 'int',
		);
	}

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'tutor_after_enrolled', array( __CLASS__, 'on_enrolled' ), 20, 3 );
		add_filter( 'tutor_allow_course_enrollment', array( __CLASS__, 'check_prereq' ), 10, 2 );
		add_action( 'transition_post_status', array( __CLASS__, 'lesson_published' ), 10, 3 );
	}

	/**
	 * Sanitise a value by type.
	 *
	 * @param mixed  $v    Value.
	 * @param string $type Type.
	 */
	public static function clean( $v, $type ) {
		switch ( $type ) {
			case 'float':
				return '' === $v ? '' : (string) round( (float) $v, 2 );
			case 'int':
				return '' === $v ? '' : (string) absint( $v );
			case 'bool':
				return $v ? '1' : '';
			case 'ids':
				return implode( ',', array_filter( array_map( 'absint', (array) $v ) ) );
			case 'url':
				return esc_url_raw( trim( (string) $v ) );
			case 'key':
				return sanitize_key( $v );
			case 'date':
				return preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $v ) ? $v : '';
			case 'datetime':
				$v = str_replace( 'T', ' ', (string) $v );
				return preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $v ) ? $v : '';
			case 'html':
				return wp_kses_post( $v );
		}
		return sanitize_text_field( $v );
	}

	/**
	 * Save course settings.
	 *
	 * @param int   $course_id Course.
	 * @param array $data      Raw data.
	 */
	public static function save_course( $course_id, $data ) {
		foreach ( self::course_fields() as $k => $type ) {
			$v = self::clean( $data[ $k ] ?? '', $type );
			if ( '' === $v ) {
				delete_post_meta( $course_id, '_dlms_' . $k );
			} else {
				update_post_meta( $course_id, '_dlms_' . $k, $v );
			}
		}
	}

	/**
	 * Save lesson settings.
	 *
	 * @param int   $lesson_id Lesson.
	 * @param array $data      Raw data.
	 */
	public static function save_lesson( $lesson_id, $data ) {
		$old_start = dlms_meta( $lesson_id, 'live_start' );
		foreach ( self::lesson_fields() as $k => $type ) {
			$v = self::clean( $data[ $k ] ?? '', $type );
			if ( '' === $v ) {
				delete_post_meta( $lesson_id, '_dlms_' . $k );
			} else {
				update_post_meta( $lesson_id, '_dlms_' . $k, $v );
			}
		}
		if ( dlms_meta( $lesson_id, 'live_start' ) !== $old_start ) {
			delete_post_meta( $lesson_id, '_dlms_reminder_sent' );
		}
	}

	/**
	 * Id list from meta.
	 *
	 * @param int    $post_id Post.
	 * @param string $key     Key.
	 * @return int[]
	 */
	public static function ids( $post_id, $key ) {
		$v = dlms_meta( $post_id, $key );
		return $v ? array_values( array_filter( array_map( 'intval', explode( ',', $v ) ) ) ) : array();
	}

	/**
	 * Course fee: our setting, else WooCommerce product price, else Tutor price.
	 *
	 * @param int $course_id Course.
	 */
	public static function fee( $course_id ) {
		$fee = dlms_meta( $course_id, 'fee' );
		if ( '' !== $fee && null !== $fee ) {
			return (float) $fee;
		}
		$product_id = (int) get_post_meta( $course_id, '_tutor_course_product_id', true );
		if ( $product_id && function_exists( 'wc_get_product' ) ) {
			$p = wc_get_product( $product_id );
			if ( $p ) {
				return (float) $p->get_price();
			}
		}
		$sale = get_post_meta( $course_id, 'tutor_course_sale_price', true );
		if ( '' !== $sale && (float) $sale > 0 ) {
			return (float) $sale;
		}
		return (float) get_post_meta( $course_id, 'tutor_course_price', true );
	}

	/**
	 * When someone is enrolled: bundles + course credit.
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 */
	public static function on_enrolled( $course_id, $user_id ) {
		foreach ( self::ids( $course_id, 'bundle_courses' ) as $child ) {
			if ( $child !== (int) $course_id && ! dlms_is_enrolled( $child, $user_id ) ) {
				dlms_enrol( $child, $user_id );
				update_user_meta( $user_id, '_dlms_bundle_' . $child, $course_id );
			}
		}
		$to = (int) dlms_meta( $course_id, 'credit_to' );
		if ( $to && ! dlms_is_enrolled( $to, $user_id ) ) {
			self::create_credit_coupon( $course_id, $to, $user_id );
		}
	}

	/**
	 * Credit amount a user has toward a course (from other courses' fee).
	 *
	 * @param int $target_course Course being bought.
	 * @param int $user_id       User.
	 * @return array [amount, from_course_id]
	 */
	public static function credit_for( $target_course, $user_id ) {
		foreach ( dlms_user_courses( $user_id ) as $cid ) {
			if ( (int) dlms_meta( $cid, 'credit_to' ) === (int) $target_course ) {
				$fee = DLMS_DB::fee( $user_id, $cid );
				$amt = $fee ? DLMS_DB::paid( $fee->id ) : self::fee( $cid );
				if ( $amt > 0 ) {
					return array( (float) $amt, $cid );
				}
			}
		}
		return array( 0, 0 );
	}

	/**
	 * Personal WooCommerce coupon worth the fee paid, valid only on the target course.
	 *
	 * @param int $from    Course already bought.
	 * @param int $to      Course to credit.
	 * @param int $user_id User.
	 */
	public static function create_credit_coupon( $from, $to, $user_id ) {
		if ( ! class_exists( 'WC_Coupon' ) ) {
			return '';
		}
		$product_id = (int) get_post_meta( $to, '_tutor_course_product_id', true );
		$user       = get_userdata( $user_id );
		if ( ! $product_id || ! $user ) {
			return '';
		}
		$amount = self::fee( $from );
		if ( $amount <= 0 ) {
			return '';
		}
		$code = 'CREDIT-' . $user_id . '-' . $to;
		if ( wc_get_coupon_id_by_code( $code ) ) {
			return $code;
		}
		$coupon = new WC_Coupon();
		$coupon->set_code( $code );
		$coupon->set_discount_type( 'fixed_product' );
		$coupon->set_amount( $amount );
		$coupon->set_product_ids( array( $product_id ) );
		$coupon->set_email_restrictions( array( $user->user_email ) );
		$coupon->set_usage_limit( 1 );
		$coupon->set_individual_use( true );
		$coupon->set_description( sprintf( 'Fee credit: %s → %s', get_the_title( $from ), get_the_title( $to ) ) );
		$coupon->save();
		update_user_meta( $user_id, '_dlms_credit_coupon_' . $to, $code );

		if ( dlms_opt( 'notify_enrolled' ) ) {
			$body = '<p>' . sprintf( 'Hi %s,', esc_html( dlms_user_name( $user_id ) ) ) . '</p>'
				. '<p>' . sprintf( 'The %1$s you paid for <strong>%2$s</strong> counts toward <strong>%3$s</strong>.', esc_html( dlms_money( $amount ) ), esc_html( get_the_title( $from ) ), esc_html( get_the_title( $to ) ) ) . '</p>'
				. '<p>Use this code at checkout: <strong style="font-size:18px">' . esc_html( $code ) . '</strong></p>'
				. '<p>' . dlms_button( get_permalink( $to ), 'See ' . get_the_title( $to ) ) . '</p>';
			dlms_mail( $user_id, 'Your fee credit for ' . get_the_title( $to ), 'Your fee credit is ready', $body );
		}
		return $code;
	}

	/**
	 * Unfinished prerequisite courses for a user.
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 * @return int[]
	 */
	public static function missing_prereqs( $course_id, $user_id ) {
		$missing = array();
		foreach ( self::ids( $course_id, 'prereq_courses' ) as $pre ) {
			if ( ! tutor_utils()->is_completed_course( $pre, $user_id ) ) {
				$missing[] = $pre;
			}
		}
		return $missing;
	}

	/**
	 * Block self-enrolment when prerequisites are not complete.
	 *
	 * @param mixed $allow     Allow.
	 * @param int   $course_id Course.
	 */
	public static function check_prereq( $allow, $course_id ) {
		if ( is_wp_error( $allow ) || ! is_user_logged_in() || current_user_can( 'manage_options' ) ) {
			return $allow;
		}
		$missing = self::missing_prereqs( $course_id, get_current_user_id() );
		if ( $missing ) {
			return new WP_Error( 'dlms_prereq', sprintf( dlms_t( 'Complete these courses first: %s' ), implode( ', ', array_map( 'get_the_title', $missing ) ) ) );
		}
		return $allow;
	}

	/**
	 * Optional email to enrolled students when a lesson is published.
	 *
	 * @param string  $new  New status.
	 * @param string  $old  Old status.
	 * @param WP_Post $post Post.
	 */
	public static function lesson_published( $new, $old, $post ) {
		if ( 'publish' !== $new || 'publish' === $old || dlms_lesson_pt() !== $post->post_type || ! dlms_opt( 'notify_new_lesson' ) ) {
			return;
		}
		$course_id = dlms_lesson_course( $post->ID );
		if ( ! $course_id ) {
			return;
		}
		foreach ( dlms_course_students( $course_id ) as $uid ) {
			$body = '<p>' . sprintf( 'Hi %s,', esc_html( dlms_user_name( $uid ) ) ) . '</p><p>' . sprintf( 'A new lesson is ready in <strong>%s</strong>: %s', esc_html( get_the_title( $course_id ) ), esc_html( $post->post_title ) ) . '</p><p>' . dlms_button( get_permalink( $post->ID ), 'Open lesson' ) . '</p>';
			dlms_mail( $uid, 'New lesson: ' . $post->post_title, 'New lesson added', $body );
		}
	}
}
