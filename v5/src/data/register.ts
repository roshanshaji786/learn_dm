// Registration form questions (/register). The stored value is the English label,
// so answers group cleanly in the admin whatever language the visitor used.

import type { T } from './content'

export type Opt = { v: string; ml: string }
export type Question = { key: Field; label: T; options: Opt[]; multi?: boolean; required?: boolean; select?: boolean }
export type Field = 'district' | 'who' | 'age' | 'interests' | 'goal' | 'budget' | 'heard_from'

export const START_LINE: T = {
  en: '7-Day AI Starter · starts Sun 1 Nov, 9 PM · ₹499',
  ml: '7-Day AI Starter · നവംബർ 1 ഞായർ, രാത്രി 9 മണി · ₹499',
}

export const questions: Question[] = [
  {
    key: 'district',
    label: { en: 'Your district', ml: 'നിങ്ങളുടെ ജില്ല' },
    select: true,
    options: [
      ['Thiruvananthapuram', 'തിരുവനന്തപുരം'], ['Kollam', 'കൊല്ലം'], ['Pathanamthitta', 'പത്തനംതിട്ട'], ['Alappuzha', 'ആലപ്പുഴ'],
      ['Kottayam', 'കോട്ടയം'], ['Idukki', 'ഇടുക്കി'], ['Ernakulam', 'എറണാകുളം'], ['Thrissur', 'തൃശ്ശൂർ'], ['Palakkad', 'പാലക്കാട്'],
      ['Malappuram', 'മലപ്പുറം'], ['Kozhikode', 'കോഴിക്കോട്'], ['Wayanad', 'വയനാട്'], ['Kannur', 'കണ്ണൂർ'], ['Kasaragod', 'കാസർഗോഡ്'],
      ['Outside Kerala', 'കേരളത്തിന് പുറത്ത്'], ['Abroad (Gulf etc.)', 'വിദേശത്ത് (Gulf etc.)'],
    ].map(([v, ml]) => ({ v, ml })),
  },
  {
    key: 'who',
    label: { en: 'You are a…', ml: 'നിങ്ങൾ…' },
    required: true,
    options: [
      { v: 'Student', ml: 'Student' },
      { v: 'Working (job)', ml: 'ജോലി ചെയ്യുന്നു' },
      { v: 'Business owner', ml: 'ബിസിനസ് ഉണ്ട്' },
      { v: 'Looking for a job', ml: 'ജോലി നോക്കുന്നു' },
      { v: 'Homemaker', ml: 'വീട്ടമ്മ / Homemaker' },
      { v: 'Freelancer', ml: 'Freelancer' },
    ],
  },
  {
    key: 'age',
    label: { en: 'Age', ml: 'പ്രായം' },
    options: ['Under 18', '18–24', '25–34', '35–44', '45+'].map((v) => ({ v, ml: v })),
  },
  {
    key: 'interests',
    label: { en: 'What do you want to learn? (pick any)', ml: 'എന്താണ് പഠിക്കേണ്ടത്? (ഒന്നിൽ കൂടുതൽ ആകാം)' },
    multi: true,
    required: true,
    options: [
      { v: 'AI tools (ChatGPT, Claude, Gemini)', ml: 'AI tools (ChatGPT, Claude, Gemini)' },
      { v: 'Dropshipping & Shopify store', ml: 'Dropshipping & Shopify store' },
      { v: 'Digital marketing & Meta ads', ml: 'Digital marketing & Meta ads' },
      { v: 'AI content & reels', ml: 'AI content & reels' },
      { v: 'WhatsApp & AI automation', ml: 'WhatsApp & AI automation' },
    ],
  },
  {
    key: 'goal',
    label: { en: 'Your main goal', ml: 'പ്രധാന ലക്ഷ്യം' },
    options: [
      { v: 'Side income', ml: 'Side income' },
      { v: 'Start my own business', ml: 'സ്വന്തം ബിസിനസ് തുടങ്ങണം' },
      { v: 'Grow my business', ml: 'ഇപ്പോഴുള്ള ബിസിനസ് വളർത്തണം' },
      { v: 'Job / freelance skill', ml: 'ജോലി / freelance skill' },
      { v: 'Just exploring', ml: 'വെറുതെ അറിയാൻ' },
    ],
  },
  {
    key: 'budget',
    label: { en: 'How much can you invest in learning?', ml: 'പഠിക്കാൻ എത്ര വരെ invest ചെയ്യാം?' },
    options: ['Under ₹1,000', '₹1,000–5,000', '₹5,000–25,000', '₹25,000+'].map((v) => ({ v, ml: v })),
  },
  {
    key: 'heard_from',
    label: { en: 'How did you find us?', ml: 'ഞങ്ങളെ എങ്ങനെ അറിഞ്ഞു?' },
    options: [
      { v: 'Instagram', ml: 'Instagram' },
      { v: 'Facebook', ml: 'Facebook' },
      { v: 'WhatsApp', ml: 'WhatsApp' },
      { v: 'Friend', ml: 'സുഹൃത്ത് പറഞ്ഞു' },
      { v: 'YouTube', ml: 'YouTube' },
      { v: 'Other', ml: 'മറ്റുള്ളവ' },
    ],
  },
]

export const r = {
  title: { en: 'Register now', ml: 'ഇപ്പോൾ Register ചെയ്യൂ' },
  intro: {
    en: 'Takes 1 minute. Roshan will WhatsApp you the class details.',
    ml: '1 മിനിറ്റ് മതി. Class details Roshan WhatsApp-ൽ അയയ്ക്കും.',
  },
  name: { en: 'Your name', ml: 'പേര്' },
  phone: { en: 'WhatsApp number', ml: 'WhatsApp നമ്പർ' },
  note: { en: 'Anything you want to ask? (optional)', ml: 'എന്തെങ്കിലും ചോദിക്കാനുണ്ടോ? (optional)' },
  pick: { en: 'Please answer:', ml: 'ഇതിന് ഉത്തരം നൽകൂ:' },
  submit: { en: 'Register', ml: 'Register ചെയ്യൂ' },
  saving: { en: 'Saving…', ml: 'Save ചെയ്യുന്നു…' },
  fail: {
    en: "Couldn't save. Please check your connection and try again, or message us on WhatsApp.",
    ml: 'Save ആയില്ല. Connection നോക്കി വീണ്ടും ശ്രമിക്കൂ, അല്ലെങ്കിൽ WhatsApp ചെയ്യൂ.',
  },
  doneTitle: { en: "You're registered!", ml: 'Registration കഴിഞ്ഞു!' },
  doneText: {
    en: 'Thank you. Roshan will WhatsApp you soon. To lock your seat now, pay ₹499.',
    ml: 'നന്ദി. Roshan ഉടൻ WhatsApp ചെയ്യും. Seat ഇപ്പോൾ തന്നെ ഉറപ്പിക്കാൻ ₹499 അടയ്ക്കൂ.',
  },
  pay: { en: 'Book my seat for ₹499', ml: '₹499 അടച്ച് seat ഉറപ്പിക്കൂ' },
  chat: { en: 'Chat on WhatsApp', ml: 'WhatsApp-ൽ chat ചെയ്യൂ' },
  privacy: { en: 'We only use your number to send class details.', ml: 'Class details അയയ്ക്കാൻ മാത്രമേ number ഉപയോഗിക്കൂ.' },
}
