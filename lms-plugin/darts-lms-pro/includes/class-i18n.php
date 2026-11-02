<?php
/**
 * English / Malayalam switch.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Translate one of our strings to the current language.
 *
 * @param string $text English text.
 */
function dlms_t( $text ) {
	return DLMS_I18n::t( $text );
}

/**
 * Echo escaped translated text.
 *
 * @param string $text English text.
 */
function dlms_e( $text ) {
	echo esc_html( DLMS_I18n::t( $text ) );
}

/**
 * Language handling.
 */
class DLMS_I18n {

	/**
	 * Current language.
	 *
	 * @var string
	 */
	private static $lang = null;

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'detect' ), 1 );
		add_filter( 'gettext_tutor', array( __CLASS__, 'tutor_gettext' ), 10, 2 );
		add_action( 'wp_footer', array( __CLASS__, 'switcher' ) );
		add_filter( 'language_attributes', array( __CLASS__, 'html_lang' ) );
	}

	/**
	 * Detect and persist language.
	 */
	public static function detect() {
		$lang = null;
		if ( isset( $_GET['lang'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			$lang = 'ml' === sanitize_key( wp_unslash( $_GET['lang'] ) ) ? 'ml' : 'en'; // phpcs:ignore WordPress.Security.NonceVerification
			if ( ! headers_sent() ) {
				setcookie( 'dlms_lang', $lang, time() + YEAR_IN_SECONDS, COOKIEPATH ? COOKIEPATH : '/', COOKIE_DOMAIN, is_ssl(), true );
			}
			if ( is_user_logged_in() ) {
				update_user_meta( get_current_user_id(), 'dlms_lang', $lang );
			}
		} elseif ( isset( $_COOKIE['dlms_lang'] ) ) {
			$lang = 'ml' === sanitize_key( wp_unslash( $_COOKIE['dlms_lang'] ) ) ? 'ml' : 'en';
		} elseif ( is_user_logged_in() && get_user_meta( get_current_user_id(), 'dlms_lang', true ) ) {
			$lang = get_user_meta( get_current_user_id(), 'dlms_lang', true );
		}
		self::$lang = $lang ? $lang : ( 'ml' === dlms_opt( 'default_lang' ) ? 'ml' : 'en' );
	}

	/**
	 * Current language.
	 */
	public static function lang() {
		if ( null === self::$lang ) {
			self::detect();
		}
		return self::$lang;
	}

	/**
	 * Language for a given user (emails).
	 *
	 * @param int $user_id User.
	 */
	public static function user_lang( $user_id ) {
		$l = get_user_meta( $user_id, 'dlms_lang', true );
		return 'ml' === $l ? 'ml' : ( 'ml' === dlms_opt( 'default_lang' ) ? 'ml' : 'en' );
	}

	/**
	 * Translate.
	 *
	 * @param string $text Text.
	 */
	public static function t( $text ) {
		if ( is_admin() && ! wp_doing_ajax() ) {
			return $text;
		}
		if ( 'ml' !== self::lang() ) {
			return $text;
		}
		$d = self::dict();
		return $d[ $text ] ?? $text;
	}

	/**
	 * Translate selected Tutor strings.
	 *
	 * @param string $translation Translation.
	 * @param string $text        Original.
	 */
	public static function tutor_gettext( $translation, $text ) {
		if ( is_admin() && ! wp_doing_ajax() ) {
			return $translation;
		}
		if ( 'ml' !== self::lang() ) {
			return $translation;
		}
		$d = self::tutor_dict();
		return $d[ $text ] ?? $translation;
	}

	/**
	 * <html lang>.
	 *
	 * @param string $out Output.
	 */
	public static function html_lang( $out ) {
		if ( ! is_admin() && 'ml' === self::lang() ) {
			$out = preg_replace( '/lang="[^"]*"/', 'lang="ml-IN"', $out );
		}
		return $out;
	}

	/**
	 * Floating EN / ML switch.
	 */
	public static function switcher() {
		if ( ! dlms_opt( 'lang_switch' ) ) {
			return;
		}
		$cur = self::lang();
		$en  = esc_url( add_query_arg( 'lang', 'en' ) );
		$ml  = esc_url( add_query_arg( 'lang', 'ml' ) );
		echo '<div class="dlms-lang" role="group" aria-label="Language">'
			. '<a href="' . $en . '" class="' . ( 'en' === $cur ? 'on' : '' ) . '" lang="en">EN</a>'
			. '<a href="' . $ml . '" class="' . ( 'ml' === $cur ? 'on' : '' ) . '" lang="ml">മലയാളം</a>'
			. '</div>';
	}

	/**
	 * Our strings.
	 */
	public static function dict() {
		return array(
			'Live class'                                   => 'ലൈവ് ക്ലാസ്',
			'Join live class'                              => 'ലൈവ് ക്ലാസിൽ ചേരുക',
			'Join opens %d minutes before the class.'      => 'ക്ലാസ് തുടങ്ങുന്നതിന് %d മിനിറ്റ് മുമ്പ് Join തുറക്കും.',
			'Class is live now'                            => 'ക്ലാസ് ഇപ്പോൾ ലൈവ് ആണ്',
			'Starts in'                                    => 'തുടങ്ങാൻ ഇനി',
			'This class has ended.'                        => 'ഈ ക്ലാസ് കഴിഞ്ഞു.',
			'Recording'                                    => 'റെക്കോർഡിംഗ്',
			'The recording will appear here after the class.' => 'ക്ലാസ് കഴിഞ്ഞാൽ റെക്കോർഡിംഗ് ഇവിടെ വരും.',
			'Add to Google Calendar'                       => 'Google Calendar-ൽ ചേർക്കുക',
			'This lesson is locked'                        => 'ഈ പാഠം ലോക്ക് ആണ്',
			'Back to course'                               => 'കോഴ്സിലേക്ക് മടങ്ങുക',
			'Unlocks on %s.'                               => '%s-ന് തുറക്കും.',
			'Finish "%s" first to unlock this lesson.'     => 'ഈ പാഠം തുറക്കാൻ ആദ്യം "%s" പൂർത്തിയാക്കുക.',
			'Your payment of %1$s was due on %2$s. Pay the balance to continue learning.' => '%2$s-ന് അടയ്ക്കേണ്ട %1$s ബാക്കിയുണ്ട്. പഠനം തുടരാൻ ബാക്കി തുക അടയ്ക്കുക.',
			'Pay by UPI to'                                => 'UPI വഴി അടയ്ക്കുക:',
			'Enrol on WhatsApp'                            => 'WhatsApp വഴി ചേരുക',
			'Ask a question'                               => 'സംശയം ചോദിക്കുക',
			'full program fee'                             => 'മുഴുവൻ കോഴ്സ് ഫീസ്',
			'Talk to us on WhatsApp first. We send the UPI payment QR there, and your login comes right after payment.' => 'ആദ്യം WhatsApp-ൽ സംസാരിക്കൂ. UPI പേയ്മെന്റ് QR അവിടെ അയക്കും, പണം അടച്ചാൽ ഉടൻ ലോഗിൻ ലഭിക്കും.',
			'Enrolment for this course is on WhatsApp. Tap "Enrol on WhatsApp" and we will help you.' => 'ഈ കോഴ്സിൽ ചേരാൻ WhatsApp-ൽ ബന്ധപ്പെടുക. "WhatsApp വഴി ചേരുക" ടാപ്പ് ചെയ്യൂ.',
			'Send screenshot on WhatsApp'                  => 'സ്ക്രീൻഷോട്ട് WhatsApp-ൽ അയയ്ക്കുക',
			'Complete these courses first: %s'             => 'ആദ്യം ഈ കോഴ്സുകൾ പൂർത്തിയാക്കുക: %s',
			'Assignment'                                   => 'അസൈൻമെന്റ്',
			'Your answer'                                  => 'നിങ്ങളുടെ ഉത്തരം',
			'Link (Google Drive, website, Canva…)'         => 'ലിങ്ക് (Google Drive, വെബ്സൈറ്റ്, Canva…)',
			'Upload a file'                                => 'ഫയൽ അപ്‌ലോഡ് ചെയ്യുക',
			'Submit assignment'                            => 'അസൈൻമെന്റ് സമർപ്പിക്കുക',
			'Update submission'                            => 'സമർപ്പണം പുതുക്കുക',
			'Submitted on %s. Waiting for marks.'          => '%s-ന് സമർപ്പിച്ചു. മാർക്കിനായി കാത്തിരിക്കുന്നു.',
			'Marks'                                        => 'മാർക്ക്',
			'Feedback'                                     => 'ഫീഡ്ബാക്ക്',
			'Due by %s'                                    => '%s-നകം സമർപ്പിക്കണം',
			'Max file size %d MB.'                         => 'പരമാവധി ഫയൽ വലുപ്പം %d MB.',
			'Assignment submitted. Thank you!'             => 'അസൈൻമെന്റ് സമർപ്പിച്ചു. നന്ദി!',
			'My Learning Hub'                              => 'എന്റെ ലേണിംഗ് ഹബ്',
			'Upcoming live classes'                        => 'വരാനിരിക്കുന്ന ലൈവ് ക്ലാസുകൾ',
			'No upcoming live classes.'                    => 'വരാനിരിക്കുന്ന ലൈവ് ക്ലാസുകളില്ല.',
			'My payments'                                  => 'എന്റെ പേയ്മെന്റുകൾ',
			'Course'                                       => 'കോഴ്സ്',
			'Fee'                                          => 'ഫീസ്',
			'Paid'                                         => 'അടച്ചത്',
			'Balance'                                      => 'ബാക്കി',
			'Next due'                                     => 'അടുത്ത തീയതി',
			'Receipts'                                     => 'രസീതുകൾ',
			'Receipt'                                      => 'രസീത്',
			'Fully paid'                                   => 'മുഴുവൻ അടച്ചു',
			'My certificates'                              => 'എന്റെ സർട്ടിഫിക്കറ്റുകൾ',
			'Download'                                     => 'ഡൗൺലോഡ്',
			'Verify'                                       => 'പരിശോധിക്കുക',
			'Finish a course to earn your certificate.'    => 'സർട്ടിഫിക്കറ്റ് ലഭിക്കാൻ ഒരു കോഴ്സ് പൂർത്തിയാക്കുക.',
			'My assignments'                               => 'എന്റെ അസൈൻമെന്റുകൾ',
			'No assignments yet.'                          => 'ഇതുവരെ അസൈൻമെന്റുകളില്ല.',
			'Waiting for marks'                            => 'മാർക്കിനായി കാത്തിരിക്കുന്നു',
			'Not submitted'                                => 'സമർപ്പിച്ചിട്ടില്ല',
			'Progress'                                     => 'പുരോഗതി',
			'Attendance'                                   => 'ഹാജർ',
			'Need help? Message us on WhatsApp'            => 'സഹായം വേണോ? WhatsApp-ൽ മെസേജ് ചെയ്യൂ',
			'Please log in to see your learning hub.'      => 'ലേണിംഗ് ഹബ് കാണാൻ ലോഗിൻ ചെയ്യുക.',
			'Log in'                                       => 'ലോഗിൻ',
			'Install app'                                  => 'ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക',
			'Certificate is valid'                         => 'സർട്ടിഫിക്കറ്റ് സാധുവാണ്',
			'Certificate not found'                        => 'സർട്ടിഫിക്കറ്റ് കണ്ടെത്തിയില്ല',
			'Enter certificate ID'                         => 'സർട്ടിഫിക്കറ്റ് ID നൽകുക',
			'Issued to'                                    => 'നൽകിയത്',
			'Issued on'                                    => 'നൽകിയ തീയതി',
			'Certificate ID'                               => 'സർട്ടിഫിക്കറ്റ് ID',
			'This certificate has been revoked.'           => 'ഈ സർട്ടിഫിക്കറ്റ് റദ്ദാക്കി.',
			'Watch recording'                              => 'റെക്കോർഡിംഗ് കാണുക',
			'You are offline'                              => 'നിങ്ങൾ ഓഫ്‌ലൈനാണ്',
			'Check your internet connection and try again.' => 'ഇന്റർനെറ്റ് കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.',
			'Today'                                        => 'ഇന്ന്',
			'Tomorrow'                                     => 'നാളെ',
		);
	}

	/**
	 * Common Tutor LMS strings shown to students.
	 */
	public static function tutor_dict() {
		return array(
			'Home'                  => 'ഹോം',
			'Courses'               => 'കോഴ്സുകൾ',
			'Dashboard'             => 'ഡാഷ്ബോർഡ്',
			'My Profile'            => 'എന്റെ പ്രൊഫൈൽ',
			'Enrolled Courses'      => 'ചേർന്ന കോഴ്സുകൾ',
			'Wishlist'              => 'വിഷ്‌ലിസ്റ്റ്',
			'Reviews'               => 'റിവ്യൂകൾ',
			'Quiz Attempts'         => 'ക്വിസ് ശ്രമങ്ങൾ',
			'Settings'              => 'ക്രമീകരണങ്ങൾ',
			'Logout'                => 'ലോഗൗട്ട്',
			'Log Out'               => 'ലോഗൗട്ട്',
			'Enroll Now'            => 'ഇപ്പോൾ ചേരുക',
			'Enroll now'            => 'ഇപ്പോൾ ചേരുക',
			'Add to cart'           => 'കാർട്ടിൽ ചേർക്കുക',
			'Start Learning'        => 'പഠനം തുടങ്ങുക',
			'Continue Learning'     => 'പഠനം തുടരുക',
			'Mark as Complete'      => 'പൂർത്തിയായി എന്ന് അടയാളപ്പെടുത്തുക',
			'Complete Course'       => 'കോഴ്സ് പൂർത്തിയാക്കുക',
			'Course Content'        => 'കോഴ്സ് ഉള്ളടക്കം',
			'Overview'              => 'അവലോകനം',
			'Previous'              => 'മുമ്പത്തേത്',
			'Next'                  => 'അടുത്തത്',
			'Lesson'                => 'പാഠം',
			'Lessons'               => 'പാഠങ്ങൾ',
			'Quiz'                  => 'ക്വിസ്',
			'Comments'              => 'അഭിപ്രായങ്ങൾ',
			'Q&A'                   => 'ചോദ്യോത്തരം',
			'Announcements'         => 'അറിയിപ്പുകൾ',
			'Exercise Files'        => 'അഭ്യാസ ഫയലുകൾ',
			'Course Progress'       => 'കോഴ്സ് പുരോഗതി',
			'Completed'             => 'പൂർത്തിയായി',
			'In Progress'           => 'പുരോഗമിക്കുന്നു',
			'Active Courses'        => 'സജീവ കോഴ്സുകൾ',
			'Completed Courses'     => 'പൂർത്തിയാക്കിയ കോഴ്സുകൾ',
			'Instructor'            => 'പരിശീലകൻ',
			'Requirements'          => 'ആവശ്യകതകൾ',
			"What Will You Learn?"  => 'നിങ്ങൾ എന്ത് പഠിക്കും?',
			'About Course'          => 'കോഴ്സിനെക്കുറിച്ച്',
			'Free'                  => 'സൗജന്യം',
			'Login'                 => 'ലോഗിൻ',
			'Sign In'               => 'സൈൻ ഇൻ',
			'Register'              => 'രജിസ്റ്റർ',
			'Search'                => 'തിരയുക',
			'Submit'                => 'സമർപ്പിക്കുക',
			'Start Quiz'            => 'ക്വിസ് തുടങ്ങുക',
			'Submit Quiz'           => 'ക്വിസ് സമർപ്പിക്കുക',
		);
	}
}
