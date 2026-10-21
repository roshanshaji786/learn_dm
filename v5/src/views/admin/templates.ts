import type { Lead } from '../../lib/supabase'

// WhatsApp message drafts. They open in WhatsApp for Roshan to review and send himself.
export function templates(lead: Lead, checkoutUrl: string) {
  const first = lead.name.split(' ')[0]
  const ml = lead.lang === 'ml'
  return [
    {
      id: 'reply',
      label: 'First reply + join link',
      text: ml
        ? `Hi ${first}, ഞാൻ Roshan, DARTS AI Academy. 7-Day AI × Shopify Starter-ൽ താല്പര്യം കാണിച്ചതിന് നന്ദി 🙏\n\nOct 24 ശനി മുതൽ ദിവസവും രാത്രി 9 മണിക്ക് live class. ₹499 അടച്ച് join ചെയ്യാം, 2 ക്ലാസ് കഴിഞ്ഞ് ഇഷ്ടപ്പെട്ടാൽ മാത്രം ബാക്കി ₹500.\n\nJoin ചെയ്യാൻ: ${checkoutUrl}`
        : `Hi ${first}, this is Roshan from DARTS AI Academy. Thanks for your interest in the 7-Day AI × Shopify Starter 🙏\n\nLive classes every night at 9 PM from Sat 24 Oct. Join for ₹499, and pay the other ₹500 only if you want to continue after Day 2.\n\nJoin here: ${checkoutUrl}`,
    },
    {
      id: 'nudge',
      label: 'Follow-up nudge',
      text: ml
        ? `Hi ${first}, ചെറിയൊരു reminder: 7-Day Starter Oct 24 ശനി രാത്രി 9-ന് തുടങ്ങും, 25 സീറ്റുകൾ മാത്രം. എന്തെങ്കിലും സംശയമുണ്ടെങ്കിൽ ചോദിക്കൂ. Join: ${checkoutUrl}`
        : `Hi ${first}, a quick reminder: the 7-Day Starter begins Sat 24 Oct at 9 PM and has only 25 seats. Any questions I can answer? Join here: ${checkoutUrl}`,
    },
    {
      id: 'welcome',
      label: 'Welcome (paid ₹499)',
      text: ml
        ? `Welcome ${first}! 🎉 നിങ്ങളുടെ സീറ്റ് confirm ആയി. Day 1 class Oct 24 ശനി രാത്രി 9 മണിക്ക്, Google Meet link class-ന് മുമ്പ് ഇവിടെ അയയ്ക്കാം. Laptop-ഉം നല്ല internet-ഉം റെഡിയാക്കി വെക്കൂ.`
        : `Welcome ${first}! 🎉 Your seat is confirmed. Day 1 is Sat 24 Oct at 9 PM. I'll send the Google Meet link here before class. Keep a laptop and good internet ready.`,
    },
    {
      id: 'second',
      label: '₹500 reminder (after Day 2)',
      text: ml
        ? `Hi ${first}, Day 1-ഉം 2-ഉം ഇഷ്ടപ്പെട്ടെന്ന് കരുതുന്നു! Day 3 മുതൽ തുടരാൻ ഇന്ന് രാത്രി 9 മണിക്ക് മുമ്പ് ₹500 അടയ്ക്കണം. YES എന്ന് reply ചെയ്താൽ payment link അയയ്ക്കാം.`
        : `Hi ${first}, I hope you enjoyed Days 1 and 2! To continue from Day 3, please pay ₹500 before tonight's 9 PM class. Reply YES and I'll send the payment link.`,
    },
  ]
}
