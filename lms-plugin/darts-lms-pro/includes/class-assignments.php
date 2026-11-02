<?php
/**
 * Assignments attached to lessons: submit, grade, feedback.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Assignments.
 */
class DLMS_Assignments {

	/**
	 * Allowed upload extensions.
	 */
	public static function allowed_ext() {
		return array( 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'webp', 'zip' );
	}

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'admin_post_dlms_submit_assignment', array( __CLASS__, 'handle_submit' ) );
		add_action( 'admin_post_dlms_grade', array( __CLASS__, 'handle_grade' ) );
		add_action( 'admin_post_dlms_file', array( __CLASS__, 'handle_file' ) );
	}

	/**
	 * Due timestamp for a user (days after unlock/enrol), 0 = none.
	 *
	 * @param int $lesson_id Lesson.
	 * @param int $user_id   User.
	 */
	public static function due_ts( $lesson_id, $user_id ) {
		$days = (int) dlms_meta( $lesson_id, 'assign_due_days' );
		if ( ! $days ) {
			return 0;
		}
		$base = DLMS_Access::unlock_ts( $lesson_id, $user_id );
		if ( ! $base ) {
			$base = DLMS_Live::start_ts( $lesson_id );
		}
		if ( ! $base ) {
			$base = DLMS_Access::enrolled_ts( dlms_lesson_course( $lesson_id ), $user_id );
		}
		return $base ? $base + $days * DAY_IN_SECONDS : 0;
	}

	/**
	 * Assignment box in a lesson.
	 *
	 * @param int $lesson_id Lesson.
	 */
	public static function box( $lesson_id ) {
		if ( ! dlms_meta( $lesson_id, 'has_assignment' ) || ! is_user_logged_in() ) {
			return '';
		}
		$uid = get_current_user_id();
		$sub = DLMS_DB::submission( $lesson_id, $uid );
		$max = (float) dlms_meta( $lesson_id, 'assign_max' );
		$due = self::due_ts( $lesson_id, $uid );
		$mb  = (int) dlms_opt( 'max_upload_mb' );

		$h  = '<div class="dlms-assignment" id="dlms-assignment">';
		$h .= '<h3>' . esc_html( dlms_t( 'Assignment' ) ) . '</h3>';
		$h .= '<div class="dlms-assign-text">' . wpautop( wp_kses_post( dlms_meta( $lesson_id, 'assign_text' ) ) ) . '</div>';
		if ( $due ) {
			$h .= '<p class="dlms-muted">' . esc_html( sprintf( dlms_t( 'Due by %s' ), dlms_date( $due, 'D, j M Y' ) ) ) . '</p>';
		}
		if ( isset( $_GET['dlms_submitted'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			$h .= '<p class="dlms-ok">' . esc_html( dlms_t( 'Assignment submitted. Thank you!' ) ) . '</p>';
		}
		if ( isset( $_GET['dlms_upload_err'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			$h .= '<p class="dlms-err">' . esc_html( sanitize_text_field( wp_unslash( $_GET['dlms_upload_err'] ) ) ) . '</p>'; // phpcs:ignore WordPress.Security.NonceVerification
		}
		if ( $sub && 'graded' === $sub->status ) {
			$h .= '<div class="dlms-grade"><strong>' . esc_html( dlms_t( 'Marks' ) ) . ':</strong> ' . esc_html( rtrim( rtrim( number_format( (float) $sub->marks, 2 ), '0' ), '.' ) ) . ( $sub->max_marks ? ' / ' . esc_html( rtrim( rtrim( number_format( (float) $sub->max_marks, 2 ), '0' ), '.' ) ) : '' );
			if ( $sub->feedback ) {
				$h .= '<br><strong>' . esc_html( dlms_t( 'Feedback' ) ) . ':</strong> ' . nl2br( esc_html( $sub->feedback ) );
			}
			$h .= '</div>';
		} elseif ( $sub ) {
			$h .= '<p class="dlms-muted">' . esc_html( sprintf( dlms_t( 'Submitted on %s. Waiting for marks.' ), mysql2date( 'j M Y, g:i A', $sub->submitted_at ) ) ) . '</p>';
		}
		if ( ! $sub || 'graded' !== $sub->status ) {
			$h .= '<form class="dlms-form" method="post" enctype="multipart/form-data" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
			$h .= wp_nonce_field( 'dlms_submit_' . $lesson_id, '_wpnonce', true, false );
			$h .= '<input type="hidden" name="action" value="dlms_submit_assignment"><input type="hidden" name="lesson_id" value="' . (int) $lesson_id . '">';
			$h .= '<label>' . esc_html( dlms_t( 'Your answer' ) ) . '<textarea name="answer" rows="5">' . esc_textarea( $sub ? (string) $sub->answer : "" ) . '</textarea></label>';
			$h .= '<label>' . esc_html( dlms_t( 'Link (Google Drive, website, Canva…)' ) ) . '<input type="url" name="link" value="' . esc_attr( $sub ? $sub->link : '' ) . '" placeholder="https://"></label>';
			$h .= '<label>' . esc_html( dlms_t( 'Upload a file' ) ) . ' <span class="dlms-muted">(' . esc_html( sprintf( dlms_t( 'Max file size %d MB.' ), $mb ) ) . ')</span><input type="file" name="file" accept=".' . esc_attr( implode( ',.', self::allowed_ext() ) ) . '"></label>';
			if ( $sub && $sub->file_name ) {
				$h .= '<p class="dlms-muted">📎 ' . esc_html( $sub->file_name ) . '</p>';
			}
			$h .= '<button class="dlms-btn" type="submit">' . esc_html( $sub ? dlms_t( 'Update submission' ) : dlms_t( 'Submit assignment' ) ) . '</button>';
			$h .= '</form>';
		}
		$h .= '</div>';
		return $h;
	}

	/**
	 * Student submit handler.
	 */
	public static function handle_submit() {
		$lesson_id = absint( $_POST['lesson_id'] ?? 0 );
		check_admin_referer( 'dlms_submit_' . $lesson_id );
		$uid       = get_current_user_id();
		$course_id = dlms_lesson_course( $lesson_id );
		$back      = get_permalink( $lesson_id );
		if ( ! $uid || ! $course_id || ! dlms_meta( $lesson_id, 'has_assignment' ) ) {
			wp_die( 'Not allowed', 403 );
		}
		if ( ! dlms_is_enrolled( $course_id, $uid ) && ! dlms_can_manage_course( $course_id ) ) {
			wp_die( 'Enrol in the course first.', 403 );
		}
		if ( DLMS_Access::lock( $lesson_id, $uid ) ) {
			wp_safe_redirect( $back );
			exit;
		}
		$existing = DLMS_DB::submission( $lesson_id, $uid );
		if ( $existing && 'graded' === $existing->status ) {
			wp_safe_redirect( $back );
			exit;
		}
		$answer    = wp_kses_post( wp_unslash( $_POST['answer'] ?? '' ) );
		$link      = esc_url_raw( wp_unslash( $_POST['link'] ?? '' ) );
		$file_path = $existing ? $existing->file_path : '';
		$file_name = $existing ? $existing->file_name : '';

		if ( ! empty( $_FILES['file']['name'] ) ) {
			$f    = $_FILES['file']; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
			$ext  = strtolower( pathinfo( $f['name'], PATHINFO_EXTENSION ) );
			$err  = '';
			$max  = (int) dlms_opt( 'max_upload_mb' ) * MB_IN_BYTES;
			if ( UPLOAD_ERR_OK !== $f['error'] ) {
				$err = 'Upload failed. Try a smaller file.';
			} elseif ( $f['size'] > $max ) {
				$err = sprintf( 'File is too big. Max %d MB.', (int) dlms_opt( 'max_upload_mb' ) );
			} elseif ( ! in_array( $ext, self::allowed_ext(), true ) ) {
				$err = 'This file type is not allowed.';
			} else {
				$check = wp_check_filetype_and_ext( $f['tmp_name'], $f['name'] );
				if ( empty( $check['ext'] ) && ! in_array( $ext, array( 'txt', 'csv' ), true ) ) {
					$err = 'This file type is not allowed.';
				}
			}
			if ( $err ) {
				wp_safe_redirect( add_query_arg( 'dlms_upload_err', rawurlencode( $err ), $back ) . '#dlms-assignment' );
				exit;
			}
			$dir  = DLMS_DB::private_dir() . '/assignments/' . $course_id;
			wp_mkdir_p( $dir );
			$safe = $uid . '-' . $lesson_id . '-' . wp_generate_password( 8, false ) . '.' . $ext;
			if ( move_uploaded_file( $f['tmp_name'], $dir . '/' . $safe ) ) {
				if ( $file_path && file_exists( $file_path ) ) {
					wp_delete_file( $file_path );
				}
				$file_path = $dir . '/' . $safe;
				$file_name = sanitize_file_name( $f['name'] );
			}
		}
		if ( ! $answer && ! $link && ! $file_path ) {
			wp_safe_redirect( add_query_arg( 'dlms_upload_err', rawurlencode( 'Add an answer, a link or a file.' ), $back ) . '#dlms-assignment' );
			exit;
		}
		global $wpdb;
		$data = array(
			'lesson_id'    => $lesson_id,
			'course_id'    => $course_id,
			'user_id'      => $uid,
			'answer'       => $answer,
			'link'         => $link,
			'file_path'    => $file_path,
			'file_name'    => $file_name,
			'status'       => 'submitted',
			'max_marks'    => (float) dlms_meta( $lesson_id, 'assign_max' ),
			'submitted_at' => current_time( 'mysql' ),
		);
		if ( $existing ) {
			$wpdb->update( DLMS_DB::t( 'submissions' ), $data, array( 'id' => $existing->id ) );
		} else {
			$wpdb->insert( DLMS_DB::t( 'submissions' ), $data );
		}
		DLMS_Notify::admin_new_submission( $lesson_id, $uid );
		wp_safe_redirect( add_query_arg( 'dlms_submitted', 1, $back ) . '#dlms-assignment' );
		exit;
	}

	/**
	 * Grade handler.
	 */
	public static function handle_grade() {
		check_admin_referer( 'dlms_grade' );
		$sub = DLMS_DB::submission_by_id( absint( $_POST['submission_id'] ?? 0 ) );
		if ( ! $sub || ! dlms_can_manage_course( $sub->course_id ) ) {
			wp_die( 'Not allowed', 403 );
		}
		global $wpdb;
		$status = sanitize_key( $_POST['status'] ?? 'graded' );
		$wpdb->update(
			DLMS_DB::t( 'submissions' ),
			array(
				'marks'     => (float) ( $_POST['marks'] ?? 0 ),
				'max_marks' => (float) ( $_POST['max_marks'] ?? $sub->max_marks ),
				'feedback'  => sanitize_textarea_field( wp_unslash( $_POST['feedback'] ?? '' ) ),
				'status'    => in_array( $status, array( 'graded', 'returned' ), true ) ? $status : 'graded',
				'graded_at' => current_time( 'mysql' ),
				'graded_by' => get_current_user_id(),
			),
			array( 'id' => $sub->id )
		);
		if ( 'graded' === $status ) {
			// Count the lesson as complete once graded.
			if ( class_exists( '\Tutor\Models\LessonModel' ) && ! tutor_utils()->is_completed_lesson( $sub->lesson_id, $sub->user_id ) ) {
				\Tutor\Models\LessonModel::mark_lesson_complete( $sub->lesson_id, $sub->user_id );
			}
			DLMS_Notify::graded( DLMS_DB::submission_by_id( $sub->id ) );
		} else {
			// Returned for a redo: student can submit again.
			$wpdb->update( DLMS_DB::t( 'submissions' ), array( 'status' => 'returned' ), array( 'id' => $sub->id ) );
			DLMS_Notify::graded( DLMS_DB::submission_by_id( $sub->id ) );
		}
		DLMS_Payments::back( 'dlms-assignments', 'Saved.', array( 'course' => $sub->course_id ) );
	}

	/**
	 * Private file download.
	 */
	public static function handle_file() {
		$sub = DLMS_DB::submission_by_id( absint( $_GET['submission'] ?? 0 ) );
		if ( ! is_user_logged_in() ) {
			auth_redirect();
		}
		if ( ! $sub || ( (int) $sub->user_id !== get_current_user_id() && ! dlms_can_manage_course( $sub->course_id ) ) ) {
			wp_die( 'Not allowed', 403 );
		}
		$path = $sub->file_path;
		$base = realpath( DLMS_DB::private_dir() );
		$real = realpath( $path );
		if ( ! $real || 0 !== strpos( $real, $base ) || ! is_file( $real ) ) {
			wp_die( 'File not found', 404 );
		}
		$type = wp_check_filetype( $real );
		nocache_headers();
		header( 'Content-Type: ' . ( $type['type'] ? $type['type'] : 'application/octet-stream' ) );
		header( 'Content-Disposition: attachment; filename="' . sanitize_file_name( $sub->file_name ) . '"' );
		header( 'Content-Length: ' . filesize( $real ) );
		readfile( $real ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}

	/**
	 * File URL.
	 *
	 * @param int $submission_id Submission.
	 */
	public static function file_url( $submission_id ) {
		return add_query_arg(
			array(
				'action'     => 'dlms_file',
				'submission' => $submission_id,
			),
			admin_url( 'admin-post.php' )
		);
	}
}
