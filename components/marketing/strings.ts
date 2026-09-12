/**
 * Public marketing site copy, EN / HI / PA / JA.
 * Long-form body text stays in English; headings, nav, CTAs and form labels are translated.
 */

export type Lang = 'en' | 'hi' | 'pa' | 'ja'

export const LANGS: { code: Lang; label: string; full: string }[] = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'hi', label: 'हिं', full: 'हिन्दी' },
  { code: 'pa', label: 'ਪੰ', full: 'ਪੰਜਾਬੀ' },
  { code: 'ja', label: '日本', full: '日本語' },
]

export const PAGES = ['home', 'lookbook', 'services', 'about', 'order', 'contact', 'faq'] as const
export type Page = (typeof PAGES)[number]

export interface Strings {
  ribbon: string; staff: string; nav: string[]
  heroEyebrow: string; heroTitle: string; heroBody: string
  ctaPrimary: string; ctaSecondary: string
  statFollowers: string; statFittings: string; statAtelier: string
  collectionsTitle: string; viewAll: string; pullQuote: string
  processTitle: string; wordsTitle: string; igNote: string; follow: string
  lookbookEyebrow: string; lookbookTitle: string; lookbookBody: string
  servicesEyebrow: string; servicesTitle: string; servicesBody: string
  aboutEyebrow: string; aboutTitle: string
  orderEyebrow: string; orderTitle: string
  contactEyebrow: string; contactTitle: string
  faqEyebrow: string; faqTitle: string
  staffEyebrow: string; staffTitle: string; staffCta: string; staffBody: string
  theAtelier: string; reachUs: string; hours: string; explore: string; visit: string
  hoursNote: string; footerTag: string
  trackIntro: string; enquiryIntro: string; fittingIntro: string
  closedMondays: string; orderTabs: string[]
  fOrderNo: string; fPhone: string; fName: string; fGarment: string; fDate: string; fNotes: string
  fTrack: string; fSend: string; fCall: string
  /** Form states — every public form on this page submits for real. */
  fSending: string; fRequired: string; fFailed: string; noPayment: string
  trackSent: string; enquirySent: string; fittingSent: string; fAgain: string
  days: string[]; closed: string
}

export const STR: Record<Lang, Strings> = {
  en: {
    ribbon: 'By appointment only', staff: 'Staff login',
    nav: ['Home', 'Lookbook', 'Services', 'About', 'Your Order', 'Contact', 'FAQ'],
    heroEyebrow: 'Bespoke tailoring · Amritsar',
    heroTitle: 'Classic tailoring, reimagined as modern luxury couture.',
    heroBody: 'Suits, sherwanis and hand-painted pieces cut to measure in Ranjit Avenue. Three fittings, cloth chosen in daylight, finished by hand.',
    ctaPrimary: 'Explore the collections', ctaSecondary: 'Book an appointment',
    statFollowers: 'Instagram following', statFittings: 'Fittings per garment', statAtelier: 'Amritsar atelier',
    collectionsTitle: 'Collections', viewAll: 'View the lookbook',
    pullQuote: 'The pleasure of dressing well, and the confidence that comes with knowing what belongs in your wardrobe.',
    processTitle: 'How a commission runs', wordsTitle: 'In their words',
    igNote: 'Wedding-season looks, fabric arrivals and behind the shears.', follow: 'Follow',
    lookbookEyebrow: 'Collections', lookbookTitle: 'The lookbook',
    lookbookBody: 'Six houses of work, cut to the same standard. Wedding-season pieces are booked eight to ten weeks ahead; visits are by appointment.',
    servicesEyebrow: 'What we make', servicesTitle: 'Services & pricing',
    servicesBody: 'Draft figures for you to edit. Every commission is quoted after the first consultation, since cloth and hand-work carry most of the cost.',
    aboutEyebrow: 'The house', aboutTitle: 'A wardrobe built one garment at a time.',
    orderEyebrow: 'Customers', orderTitle: 'Your order',
    contactEyebrow: 'Visit', contactTitle: 'Come and see the cloth.',
    faqEyebrow: 'Questions', faqTitle: 'Before you commission',
    staffEyebrow: 'Team', staffTitle: 'Staff login', staffCta: 'Open the management app',
    staffBody: 'Inventory, orders, production and reporting live in the Hamees Attire management app. Sign in with the account issued to you; what you see depends on your role.',
    theAtelier: 'The atelier', reachUs: 'Reach us', hours: 'Hours', explore: 'Explore', visit: 'Visit',
    hoursNote: 'Hours may differ on festival days. Fittings are by appointment.',
    footerTag: 'Bespoke tailoring and wedding attire, made in Amritsar.',
    trackIntro: 'Enter the order number on your receipt and the phone number on file. We send a link to that number on WhatsApp — it works for 30 minutes.',
    enquiryIntro: 'Tell us what you need and when you need it. We reply on WhatsApp within a working day.',
    fittingIntro: 'The atelier runs by appointment. Leave your name and a day, and we confirm the hour by phone.',
    closedMondays: 'Closed Mondays. Tuesday to Sunday, 11:00–21:00.',
    orderTabs: ['Track an order', 'New enquiry', 'Book a fitting'],
    fOrderNo: 'Order number', fPhone: 'Phone', fName: 'Name', fGarment: 'Garment', fDate: 'Event or fitting date', fNotes: 'Notes',
    fTrack: 'Send me the link', fSend: 'Send enquiry', fCall: 'Call the atelier',
    fSending: 'Sending…', fRequired: 'Please fill in the fields marked with a dot.',
    fFailed: 'We could not reach the shop. Please try again, or call us.',
    trackSent: 'If that order number matches the phone number we have on file, the link is on its way to your WhatsApp. It is valid for 30 minutes.',
    enquirySent: 'Thank you — we have your enquiry. Someone from the atelier will call you to agree the fabric, take your measurements and give you a price.',
    fittingSent: 'Thank you — we have your request. We will call you to confirm the hour.',
    fAgain: 'Send another',
    noPayment: 'No payment is taken and nothing is ordered from this page.',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], closed: 'Closed',
  },
  hi: {
    ribbon: 'केवल अपॉइंटमेंट पर', staff: 'स्टाफ़ लॉगिन',
    nav: ['होम', 'लुकबुक', 'सेवाएँ', 'हमारे बारे में', 'आपका ऑर्डर', 'संपर्क', 'सवाल'],
    heroEyebrow: 'बेस्पोक सिलाई · अमृतसर',
    heroTitle: 'पारंपरिक सिलाई, आधुनिक लक्ज़री कूटूर के रूप में।',
    heroBody: 'रणजीत एवेन्यू में नाप के अनुसार सूट, शेरवानी और हाथ से पेंट किए गए परिधान। तीन फ़िटिंग, दिन के उजाले में चुना कपड़ा, हाथ की फिनिश।',
    ctaPrimary: 'कलेक्शन देखें', ctaSecondary: 'अपॉइंटमेंट बुक करें',
    statFollowers: 'इंस्टाग्राम फ़ॉलोअर्स', statFittings: 'प्रति परिधान फ़िटिंग', statAtelier: 'अमृतसर एटेलियर',
    collectionsTitle: 'कलेक्शन', viewAll: 'पूरी लुकबुक देखें',
    pullQuote: 'अच्छा पहनने का सुख, और यह जानने का आत्मविश्वास कि आपकी अलमारी में क्या होना चाहिए।',
    processTitle: 'ऑर्डर कैसे बनता है', wordsTitle: 'ग्राहकों के शब्दों में',
    igNote: 'शादी के मौसम के लुक, नए कपड़े और कारीगरी की झलक।', follow: 'फ़ॉलो करें',
    lookbookEyebrow: 'कलेक्शन', lookbookTitle: 'लुकबुक',
    lookbookBody: 'छह श्रेणियाँ, एक ही स्तर की कारीगरी। शादी के मौसम के ऑर्डर आठ से दस हफ़्ते पहले लिए जाते हैं; मुलाक़ात अपॉइंटमेंट से।',
    servicesEyebrow: 'हम क्या बनाते हैं', servicesTitle: 'सेवाएँ और कीमतें',
    servicesBody: 'ये अनुमानित आँकड़े हैं, आप इन्हें बदल सकते हैं। हर ऑर्डर का अंतिम मूल्य पहली बैठक के बाद तय होता है।',
    aboutEyebrow: 'हमारा घर', aboutTitle: 'एक-एक परिधान से बनी अलमारी।',
    orderEyebrow: 'ग्राहक', orderTitle: 'आपका ऑर्डर',
    contactEyebrow: 'आइए', contactTitle: 'कपड़ा अपनी आँखों से देखिए।',
    faqEyebrow: 'सवाल', faqTitle: 'ऑर्डर देने से पहले',
    staffEyebrow: 'टीम', staffTitle: 'स्टाफ़ लॉगिन', staffCta: 'मैनेजमेंट ऐप खोलें',
    staffBody: 'इन्वेंटरी, ऑर्डर, प्रोडक्शन और रिपोर्टिंग सब हमीस अटायर मैनेजमेंट ऐप में हैं। अपने खाते से साइन इन करें; आपकी भूमिका के अनुसार पहुँच मिलेगी।',
    theAtelier: 'एटेलियर', reachUs: 'संपर्क करें', hours: 'समय', explore: 'पन्ने', visit: 'पता',
    hoursNote: 'त्योहारों पर समय बदल सकता है। फ़िटिंग अपॉइंटमेंट से।',
    footerTag: 'अमृतसर में बनी बेस्पोक सिलाई और वेडिंग अटायर।',
    trackIntro: 'रसीद पर लिखा ऑर्डर नंबर और रजिस्टर्ड फ़ोन नंबर डालें। हम उसी नंबर पर व्हाट्सएप से लिंक भेजेंगे — वह 30 मिनट तक चलेगा।',
    enquiryIntro: 'बताइए आपको क्या और कब चाहिए। हम एक कार्यदिवस में व्हाट्सएप पर जवाब देते हैं।',
    fittingIntro: 'एटेलियर अपॉइंटमेंट पर चलता है। अपना नाम और दिन लिखें, समय हम फ़ोन पर तय कर लेंगे।',
    closedMondays: 'सोमवार बंद। मंगलवार से रविवार, 11:00–21:00।',
    orderTabs: ['ऑर्डर ट्रैक करें', 'नई पूछताछ', 'फ़िटिंग बुक करें'],
    fOrderNo: 'ऑर्डर नंबर', fPhone: 'फ़ोन', fName: 'नाम', fGarment: 'परिधान', fDate: 'कार्यक्रम या फ़िटिंग की तारीख़', fNotes: 'टिप्पणी',
    fTrack: 'मुझे लिंक भेजें', fSend: 'पूछताछ भेजें', fCall: 'एटेलियर को कॉल करें',
    fSending: 'भेजा जा रहा है…', fRequired: 'कृपया बिंदु लगे ख़ाने भरें।',
    fFailed: 'हम दुकान तक नहीं पहुँच सके। दोबारा कोशिश करें, या हमें कॉल करें।',
    trackSent: 'अगर वह ऑर्डर नंबर हमारे रिकॉर्ड के फ़ोन नंबर से मेल खाता है, तो लिंक आपके व्हाट्सएप पर भेज दिया गया है। यह 30 मिनट तक चलेगा।',
    enquirySent: 'धन्यवाद — आपकी पूछताछ मिल गई। एटेलियर से कोई आपको कॉल करके कपड़ा, नाप और क़ीमत तय करेगा।',
    fittingSent: 'धन्यवाद — आपका अनुरोध मिल गया। समय पक्का करने के लिए हम आपको कॉल करेंगे।',
    fAgain: 'एक और भेजें',
    noPayment: 'इस पेज से कोई भुगतान नहीं लिया जाता और कोई ऑर्डर दर्ज नहीं होता।',
    days: ['सोमवार', 'मंगलवार', 'बुधवार', 'बृहस्पतिवार', 'शुक्रवार', 'शनिवार', 'रविवार'], closed: 'बंद',
  },
  pa: {
    ribbon: 'ਸਿਰਫ਼ ਮੁਲਾਕਾਤ ਨਾਲ', staff: 'ਸਟਾਫ਼ ਲੌਗਇਨ',
    nav: ['ਘਰ', 'ਲੁੱਕਬੁੱਕ', 'ਸੇਵਾਵਾਂ', 'ਸਾਡੇ ਬਾਰੇ', 'ਤੁਹਾਡਾ ਆਰਡਰ', 'ਸੰਪਰਕ', 'ਸਵਾਲ'],
    heroEyebrow: 'ਬੈਸਪੋਕ ਸਿਲਾਈ · ਅੰਮ੍ਰਿਤਸਰ',
    heroTitle: 'ਰਵਾਇਤੀ ਸਿਲਾਈ, ਨਵੇਂ ਜ਼ਮਾਨੇ ਦੀ ਲਗਜ਼ਰੀ ਕੂਟੂਰ ਵਾਂਗ।',
    heroBody: 'ਰਣਜੀਤ ਐਵੇਨਿਊ ਵਿੱਚ ਨਾਪ ਮੁਤਾਬਕ ਸੂਟ, ਸ਼ੇਰਵਾਨੀਆਂ ਅਤੇ ਹੱਥ ਨਾਲ ਪੇਂਟ ਕੀਤੇ ਕੱਪੜੇ। ਤਿੰਨ ਫ਼ਿਟਿੰਗਾਂ, ਦਿਨ ਦੀ ਰੌਸ਼ਨੀ ਵਿੱਚ ਚੁਣਿਆ ਕੱਪੜਾ, ਹੱਥ ਦੀ ਫ਼ਿਨਿਸ਼।',
    ctaPrimary: 'ਕਲੈਕਸ਼ਨ ਵੇਖੋ', ctaSecondary: 'ਮੁਲਾਕਾਤ ਬੁੱਕ ਕਰੋ',
    statFollowers: 'ਇੰਸਟਾਗ੍ਰਾਮ ਫ਼ਾਲੋਅਰ', statFittings: 'ਹਰ ਕੱਪੜੇ ਲਈ ਫ਼ਿਟਿੰਗਾਂ', statAtelier: 'ਅੰਮ੍ਰਿਤਸਰ ਐਟਲੀਏ',
    collectionsTitle: 'ਕਲੈਕਸ਼ਨ', viewAll: 'ਪੂਰੀ ਲੁੱਕਬੁੱਕ ਵੇਖੋ',
    pullQuote: 'ਚੰਗਾ ਪਹਿਨਣ ਦਾ ਸੁਆਦ, ਤੇ ਇਹ ਜਾਣਨ ਦਾ ਭਰੋਸਾ ਕਿ ਤੁਹਾਡੀ ਅਲਮਾਰੀ ਵਿੱਚ ਕੀ ਸਜਦਾ ਹੈ।',
    processTitle: 'ਆਰਡਰ ਕਿਵੇਂ ਬਣਦਾ ਹੈ', wordsTitle: 'ਗਾਹਕਾਂ ਦੇ ਬੋਲ',
    igNote: 'ਵਿਆਹ ਦੇ ਸੀਜ਼ਨ ਦੇ ਲੁੱਕ, ਨਵੇਂ ਕੱਪੜੇ ਤੇ ਕਾਰੀਗਰੀ ਦੀਆਂ ਝਲਕਾਂ।', follow: 'ਫ਼ਾਲੋ ਕਰੋ',
    lookbookEyebrow: 'ਕਲੈਕਸ਼ਨ', lookbookTitle: 'ਲੁੱਕਬੁੱਕ',
    lookbookBody: 'ਛੇ ਸ਼੍ਰੇਣੀਆਂ, ਇੱਕੋ ਪੱਧਰ ਦੀ ਕਾਰੀਗਰੀ। ਵਿਆਹ ਦੇ ਸੀਜ਼ਨ ਦੇ ਆਰਡਰ ਅੱਠ ਤੋਂ ਦਸ ਹਫ਼ਤੇ ਪਹਿਲਾਂ ਲਏ ਜਾਂਦੇ ਹਨ; ਮਿਲਣਾ ਮੁਲਾਕਾਤ ਨਾਲ।',
    servicesEyebrow: 'ਅਸੀਂ ਕੀ ਬਣਾਉਂਦੇ ਹਾਂ', servicesTitle: 'ਸੇਵਾਵਾਂ ਤੇ ਕੀਮਤਾਂ',
    servicesBody: 'ਇਹ ਅੰਦਾਜ਼ਨ ਅੰਕੜੇ ਹਨ, ਤੁਸੀਂ ਬਦਲ ਸਕਦੇ ਹੋ। ਹਰ ਆਰਡਰ ਦੀ ਕੀਮਤ ਪਹਿਲੀ ਬੈਠਕ ਤੋਂ ਬਾਅਦ ਤੈਅ ਹੁੰਦੀ ਹੈ।',
    aboutEyebrow: 'ਸਾਡਾ ਘਰ', aboutTitle: 'ਇੱਕ-ਇੱਕ ਕੱਪੜੇ ਨਾਲ ਬਣੀ ਅਲਮਾਰੀ।',
    orderEyebrow: 'ਗਾਹਕ', orderTitle: 'ਤੁਹਾਡਾ ਆਰਡਰ',
    contactEyebrow: 'ਆਓ', contactTitle: 'ਕੱਪੜਾ ਆਪਣੀ ਅੱਖ ਨਾਲ ਵੇਖੋ।',
    faqEyebrow: 'ਸਵਾਲ', faqTitle: 'ਆਰਡਰ ਦੇਣ ਤੋਂ ਪਹਿਲਾਂ',
    staffEyebrow: 'ਟੀਮ', staffTitle: 'ਸਟਾਫ਼ ਲੌਗਇਨ', staffCta: 'ਮੈਨੇਜਮੈਂਟ ਐਪ ਖੋਲ੍ਹੋ',
    staffBody: 'ਇਨਵੈਂਟਰੀ, ਆਰਡਰ, ਪ੍ਰੋਡਕਸ਼ਨ ਤੇ ਰਿਪੋਰਟਿੰਗ ਹਮੀਸ ਅਟਾਇਰ ਮੈਨੇਜਮੈਂਟ ਐਪ ਵਿੱਚ ਹਨ। ਆਪਣੇ ਖਾਤੇ ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ; ਪਹੁੰਚ ਤੁਹਾਡੀ ਭੂਮਿਕਾ ਮੁਤਾਬਕ ਮਿਲੇਗੀ।',
    theAtelier: 'ਐਟਲੀਏ', reachUs: 'ਸੰਪਰਕ', hours: 'ਸਮਾਂ', explore: 'ਸਫ਼ੇ', visit: 'ਪਤਾ',
    hoursNote: "ਤਿਉਹਾਰਾਂ 'ਤੇ ਸਮਾਂ ਬਦਲ ਸਕਦਾ ਹੈ। ਫ਼ਿਟਿੰਗ ਮੁਲਾਕਾਤ ਨਾਲ।",
    footerTag: 'ਅੰਮ੍ਰਿਤਸਰ ਵਿੱਚ ਬਣੀ ਬੈਸਪੋਕ ਸਿਲਾਈ ਤੇ ਵਿਆਹ ਦੀ ਪੁਸ਼ਾਕ।',
    trackIntro: "ਰਸੀਦ 'ਤੇ ਲਿਖਿਆ ਆਰਡਰ ਨੰਬਰ ਤੇ ਰਜਿਸਟਰ ਕੀਤਾ ਫ਼ੋਨ ਨੰਬਰ ਭਰੋ। ਅਸੀਂ ਉਸੇ ਨੰਬਰ 'ਤੇ ਵਟਸਐਪ ਰਾਹੀਂ ਲਿੰਕ ਭੇਜਾਂਗੇ — ਉਹ 30 ਮਿੰਟ ਚੱਲੇਗਾ।",
    enquiryIntro: "ਦੱਸੋ ਤੁਹਾਨੂੰ ਕੀ ਤੇ ਕਦੋਂ ਚਾਹੀਦਾ ਹੈ। ਅਸੀਂ ਇੱਕ ਕੰਮ-ਦਿਨ ਵਿੱਚ ਵਟਸਐਪ 'ਤੇ ਜਵਾਬ ਦਿੰਦੇ ਹਾਂ।",
    fittingIntro: "ਐਟਲੀਏ ਮੁਲਾਕਾਤ ਨਾਲ ਚੱਲਦਾ ਹੈ। ਆਪਣਾ ਨਾਮ ਤੇ ਦਿਨ ਲਿਖੋ, ਵੇਲਾ ਅਸੀਂ ਫ਼ੋਨ 'ਤੇ ਪੱਕਾ ਕਰ ਲਵਾਂਗੇ।",
    closedMondays: 'ਸੋਮਵਾਰ ਬੰਦ। ਮੰਗਲਵਾਰ ਤੋਂ ਐਤਵਾਰ, 11:00–21:00।',
    orderTabs: ['ਆਰਡਰ ਟਰੈਕ ਕਰੋ', 'ਨਵੀਂ ਪੁੱਛਗਿੱਛ', 'ਫ਼ਿਟਿੰਗ ਬੁੱਕ ਕਰੋ'],
    fOrderNo: 'ਆਰਡਰ ਨੰਬਰ', fPhone: 'ਫ਼ੋਨ', fName: 'ਨਾਮ', fGarment: 'ਪੁਸ਼ਾਕ', fDate: 'ਸਮਾਗਮ ਜਾਂ ਫ਼ਿਟਿੰਗ ਦੀ ਤਾਰੀਖ਼', fNotes: 'ਟਿੱਪਣੀ',
    fTrack: 'ਮੈਨੂੰ ਲਿੰਕ ਭੇਜੋ', fSend: 'ਪੁੱਛਗਿੱਛ ਭੇਜੋ', fCall: 'ਐਟਲੀਏ ਨੂੰ ਕਾਲ ਕਰੋ',
    fSending: 'ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…', fRequired: 'ਕਿਰਪਾ ਕਰਕੇ ਬਿੰਦੀ ਵਾਲੇ ਖ਼ਾਨੇ ਭਰੋ।',
    fFailed: 'ਅਸੀਂ ਦੁਕਾਨ ਤੱਕ ਨਹੀਂ ਪਹੁੰਚ ਸਕੇ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਜਾਂ ਸਾਨੂੰ ਕਾਲ ਕਰੋ।',
    trackSent: "ਜੇ ਉਹ ਆਰਡਰ ਨੰਬਰ ਸਾਡੇ ਰਿਕਾਰਡ ਵਾਲੇ ਫ਼ੋਨ ਨੰਬਰ ਨਾਲ ਮਿਲਦਾ ਹੈ, ਤਾਂ ਲਿੰਕ ਤੁਹਾਡੇ ਵਟਸਐਪ 'ਤੇ ਭੇਜ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਇਹ 30 ਮਿੰਟ ਚੱਲੇਗਾ।",
    enquirySent: 'ਧੰਨਵਾਦ — ਤੁਹਾਡੀ ਪੁੱਛਗਿੱਛ ਮਿਲ ਗਈ। ਐਟਲੀਏ ਤੋਂ ਕੋਈ ਤੁਹਾਨੂੰ ਕਾਲ ਕਰਕੇ ਕੱਪੜਾ, ਨਾਪ ਤੇ ਕੀਮਤ ਤੈਅ ਕਰੇਗਾ।',
    fittingSent: 'ਧੰਨਵਾਦ — ਤੁਹਾਡੀ ਬੇਨਤੀ ਮਿਲ ਗਈ। ਵੇਲਾ ਪੱਕਾ ਕਰਨ ਲਈ ਅਸੀਂ ਤੁਹਾਨੂੰ ਕਾਲ ਕਰਾਂਗੇ।',
    fAgain: 'ਇੱਕ ਹੋਰ ਭੇਜੋ',
    noPayment: 'ਇਸ ਪੰਨੇ ਤੋਂ ਕੋਈ ਭੁਗਤਾਨ ਨਹੀਂ ਲਿਆ ਜਾਂਦਾ ਤੇ ਕੋਈ ਆਰਡਰ ਦਰਜ ਨਹੀਂ ਹੁੰਦਾ।',
    days: ['ਸੋਮਵਾਰ', 'ਮੰਗਲਵਾਰ', 'ਬੁੱਧਵਾਰ', 'ਵੀਰਵਾਰ', 'ਸ਼ੁੱਕਰਵਾਰ', 'ਸ਼ਨੀਵਾਰ', 'ਐਤਵਾਰ'], closed: 'ਬੰਦ',
  },
  ja: {
    ribbon: '完全予約制', staff: 'スタッフ用ログイン',
    nav: ['ホーム', 'ルックブック', 'サービス', '私たちについて', 'ご注文', 'お問い合わせ', 'よくある質問'],
    heroEyebrow: 'ビスポーク・テーラリング · アムリトサル',
    heroTitle: '古典の仕立てを、現代のラグジュアリー・クチュールへ。',
    heroBody: 'ランジート・アヴェニューの工房で、スーツ、シェルワニ、手描きの一点物をお仕立てします。三回の仮縫い、自然光で選ぶ生地、手仕上げ。',
    ctaPrimary: 'コレクションを見る', ctaSecondary: 'ご予約',
    statFollowers: 'Instagram フォロワー', statFittings: '一着あたりの仮縫い', statAtelier: 'アムリトサルの工房',
    collectionsTitle: 'コレクション', viewAll: 'ルックブックへ',
    pullQuote: 'よく装う愉しみ、そして自分の衣装棚に何がふさわしいかを知る自信。',
    processTitle: 'ご注文の流れ', wordsTitle: 'お客様の声',
    igNote: '婚礼シーズンの装い、入荷生地、仕立ての裏側。', follow: 'フォロー',
    lookbookEyebrow: 'コレクション', lookbookTitle: 'ルックブック',
    lookbookBody: '六つの分野、同じ基準の仕立て。婚礼シーズンは八〜十週間前のご予約を承ります。ご来店は予約制です。',
    servicesEyebrow: 'お仕立ての内容', servicesTitle: 'サービスと料金',
    servicesBody: '目安の金額です。生地と手仕事が費用の大半を占めるため、最終見積りは初回のご相談後にお出しします。',
    aboutEyebrow: '工房について', aboutTitle: '一着ずつ積み上げる衣装棚。',
    orderEyebrow: 'お客様', orderTitle: 'ご注文',
    contactEyebrow: 'ご来店', contactTitle: '生地を実際にご覧ください。',
    faqEyebrow: 'ご質問', faqTitle: 'ご注文の前に',
    staffEyebrow: 'チーム', staffTitle: 'スタッフ用ログイン', staffCta: '管理アプリを開く',
    staffBody: '在庫、注文、製作、レポートは Hamees Attire 管理アプリで扱います。付与されたアカウントでサインインしてください。表示内容は役割によって異なります。',
    theAtelier: '工房', reachUs: '連絡先', hours: '営業時間', explore: 'ページ', visit: '所在地',
    hoursNote: '祝祭日は時間が変わる場合があります。仮縫いは予約制です。',
    footerTag: 'アムリトサルで仕立てるビスポークと婚礼衣装。',
    trackIntro: '領収書の注文番号と、ご登録のお電話番号をご入力ください。そのお電話番号宛に WhatsApp でリンクをお送りします（30分間有効）。',
    enquiryIntro: 'ご希望の品と時期をお知らせください。一営業日以内に WhatsApp でご返信します。',
    fittingIntro: '工房は予約制です。お名前とご希望の日をお知らせいただければ、時間はお電話で確定します。',
    closedMondays: '月曜定休。火曜〜日曜 11:00–21:00。',
    orderTabs: ['注文状況の確認', '新規のお問い合わせ', '仮縫いのご予約'],
    fOrderNo: '注文番号', fPhone: '電話番号', fName: 'お名前', fGarment: '品目', fDate: 'ご使用日・仮縫い希望日', fNotes: 'ご要望',
    fTrack: 'リンクを送る', fSend: 'お問い合わせを送る', fCall: '工房に電話',
    fSending: '送信中…', fRequired: '印のついた項目をご入力ください。',
    fFailed: '工房に接続できませんでした。もう一度お試しいただくか、お電話ください。',
    trackSent: 'ご入力の注文番号がご登録のお電話番号と一致する場合、WhatsApp にリンクをお送りしました。30分間有効です。',
    enquirySent: 'ありがとうございます。お問い合わせを承りました。生地・採寸・お見積りについて工房よりお電話いたします。',
    fittingSent: 'ありがとうございます。ご予約の希望を承りました。時間の確定はお電話でご連絡いたします。',
    fAgain: 'もう一件送る',
    noPayment: 'このページでお支払いは発生せず、ご注文も確定いたしません。',
    days: ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'], closed: '定休',
  },
}

export const COLLECTIONS = [
  { key: 'bespoke', img: '/marketing/bespoke.png', name: 'Bespoke',
    note: 'Cut from your pattern, nothing borrowed.',
    long: 'A full bespoke commission: your own paper pattern, cloth chosen together, three fittings and a canvas built by hand. This is the work the house is known for.',
    meta: 'From 6 weeks · 3 fittings' },
  { key: 'suits', img: '/marketing/suits.png', name: 'Suits',
    note: 'Two and three-piece, soft shoulder.',
    long: 'Business and occasion suiting in a soft Punjabi silhouette. Lightweight canvas for Amritsar summers, heavier worsteds for winter weddings.',
    meta: 'From 4 weeks · 2 fittings' },
  { key: 'wedding', img: '/marketing/wedding.png', name: 'Wedding & Groom',
    note: 'Sherwani, bandhgala, the whole party.',
    long: 'Groom wear and family sets: sherwanis, bandhgalas, jodhpuris, with dupatta, safa and buttons matched to the cloth. Books out first every season.',
    meta: 'Book 8–10 weeks ahead' },
  { key: 'art', img: '/marketing/handpainted.png', name: 'Hand-painted / Art',
    note: 'Painted linen, one of one.',
    long: 'Hand-painted linen developed by our creative head Harlagan Singh — bold outlines, earthy strokes, each piece finished as a single edition.',
    meta: 'One of one · 3 weeks' },
  { key: 'celebrities', img: '/marketing/celebrities.png', name: 'Celebrities',
    note: 'Stage, album and screen wardrobes.',
    long: 'Wardrobes built around the performer: sculpted tailoring and elevated Punjabi silhouettes for album shoots, tours and film.',
    meta: 'By arrangement' },
  { key: 'accessories', img: '/marketing/accessories.png', name: 'Accessories',
    note: 'Buttons, ties, safa, squares.',
    long: 'The small pieces that finish a look: hand-knotted ties, pocket squares, safa cloth and buttons cut to match the garment.',
    meta: 'In store' },
]

export const IG_IMGS = [
  '/marketing/cafe.png', '/marketing/doors.png', '/marketing/handpainted.png',
  '/marketing/suits.png', '/marketing/wedding.png', '/marketing/celebrities.png',
]

export const STEPS = [
  { num: 'I', title: 'Consultation', body: 'Bring the invitation or the brief. We talk cloth, silhouette and date, in daylight, in the shop.' },
  { num: 'II', title: 'Measure & pattern', body: 'Full measurements go on file. Your pattern is cut to them and kept for future orders.' },
  { num: 'III', title: 'Three fittings', body: 'Basted fit, shaped fit, final. Adjustments happen while the garment can still change.' },
  { num: 'IV', title: 'Hand finish', body: 'Buttonholes, edges and lining finished by hand, then pressed and packed for the day.' },
]

export const SERVICES = [
  { name: 'Bespoke two-piece suit', detail: 'Own pattern, half or full canvas, three fittings.', time: '4–6 weeks', price: '₹38,000+' },
  { name: 'Bespoke three-piece suit', detail: 'Matching or contrast waistcoat.', time: '5–6 weeks', price: '₹46,000+' },
  { name: 'Groom sherwani', detail: 'With dupatta, safa cloth and matched buttons.', time: '8–10 weeks', price: '₹65,000+' },
  { name: 'Bandhgala / Jodhpuri', detail: 'Closed-neck jacket with trouser or churidar.', time: '5–7 weeks', price: '₹42,000+' },
  { name: 'Hand-painted linen shirt', detail: 'Single edition, painted by hand.', time: '2–3 weeks', price: '₹14,000+' },
  { name: 'Alterations for our garments', detail: 'Free within three months of delivery.', time: '3–7 days', price: 'Included' },
]

export const FAQS = [
  { q: 'How far ahead should I book for a wedding?', a: 'Eight to ten weeks for groom wear, and earlier if the date falls in the November–February season. Family sets need the same runway, so bring everyone’s dates at once.' },
  { q: 'Do you keep my measurements on file?', a: 'Yes. Your pattern and measurements are stored against your customer record, so a repeat order can start from a phone call. Weight changes are easy to adjust for.' },
  { q: 'Can I supply my own cloth?', a: 'You can. We will advise whether the quantity is enough for the cut you want before anything is cut.' },
  { q: 'Do you ship outside India?', a: 'We do, for customers who have been measured with us at least once. Courier and duties are quoted separately.' },
  { q: 'What is the deposit?', a: 'Half at commission, the balance on delivery. Cloth is ordered against the deposit, so it is non-refundable once cut.' },
  { q: 'Are alterations included?', a: 'Alterations on garments we made are free within three months of delivery.' },
]

export const TESTIMONIALS = [
  { quote: 'The fit was right at the second fitting, and right again a year later.', who: 'Customer name · Amritsar' },
  { quote: 'They understood the stage before I explained it.', who: 'Artist credit · album wardrobe' },
  { quote: 'My brother’s sherwani and mine, six weeks, no panic.', who: 'Customer name · wedding party' },
]

export const ROLES = [
  { name: 'Owner', scope: 'Everything except settings, user management and deletions.' },
  { name: 'Administrator', scope: 'Full access: users, settings, deletions and bulk upload.' },
  { name: 'Inventory Manager', scope: 'Inventory, purchase orders, garment types and suppliers.' },
  { name: 'Sales Manager', scope: 'Orders, customers, measurements and tailor assignment.' },
  { name: 'Master Tailor', scope: 'All orders, tailor assignment and production oversight.' },
  { name: 'Tailor', scope: 'Assigned orders only: status, notes and measurements.' },
  { name: 'Viewer', scope: 'Read-only dashboard, inventory, customers and orders.' },
]

export const HOUR_TIMES = ['closed', '11:00 – 21:00', '11:00 – 21:00', '11:00 – 21:00', '11:00 – 21:00', '11:00 – 21:00', '11:00 – 21:00']
