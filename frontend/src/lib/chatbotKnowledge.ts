
export interface KnowledgeItem {
  id: string;
  patterns: string[]; // Keywords or phrases to match
  role: 'all' | 'owner' | 'tenant';
  response: {
    en: string;
    ta: string;
  };
}

export const KNOWLEDGE_BASE: KnowledgeItem[] = [
  // --- COMMON QUESTIONS ---
  {
    id: 'about_reside',
    patterns: ['what is reside', 'about app', 'who are you', 'what do you do'],
    role: 'all',
    response: {
      en: "I am the reSideAI Assistant. reSideAI is a comprehensive property management platform that helps owners manage properties and tenants manage their stay seamlessly.",
      ta: "நான் reSideAI உதவியாளர். reSideAI என்பது உரிமையாளர்கள் மற்றும் வாடகைதாரர்கள் தங்கள் சொத்து மற்றும் தங்குமிடத்தை எளிதாக நிர்வகிக்க உதவும் ஒரு முழுமையான தளமாகும்."
    }
  },
  {
    id: 'contact_support',
    patterns: ['contact support', 'help line', 'customer care', 'issue', 'problem'],
    role: 'all',
    response: {
      en: "For support, you can email us at support@resideai.com or use the 'Help' section in your profile settings.",
      ta: "ஆதரவிற்கு, support@resideai.com என்ற மின்னஞ்சலில் எங்களை தொடர்பு கொள்ளலாம் அல்லது உங்கள் சுயவிவர அமைப்புகளில் உள்ள 'உதவி' பிரிவைப் பயன்படுத்தலாம்."
    }
  },
  {
    id: 'password_reset',
    patterns: ['reset password', 'forgot password', 'change password'],
    role: 'all',
    response: {
      en: "You can reset your password from the login screen by clicking 'Forgot Password', or update it in your Profile settings if you are logged in.",
      ta: "உள்நுழைவு திரையில் 'கடவுச்சொல்லை மறந்துவிட்டேன்' என்பதைக் கிளிக் செய்வதன் மூலம் அல்லது உள்நுழைந்திருந்தால் சுயவிவர அமைப்புகளில் அதை மாற்றலாம்."
    }
  },

  {
    id: 'app_features',
    patterns: ['what can i do', 'features', 'capabilities', 'how does it work'],
    role: 'all',
    response: {
      en: "reSideAI allows owners to list properties and manage tenants, while tenants can search for homes, pay rent online, and manage their stay.",
      ta: "reSideAI உரிமையாளர்கள் சொத்துக்களைப் பட்டியலிடவும் குத்தகைதாரர்களை நிர்வகிக்கவும் அனுமதிக்கிறது, அதே நேரத்தில் குத்தகைதாரர்கள் வீடுகளைத் தேடலாம், ஆன்லைனில் வாடகை செலுத்தலாம் மற்றும் தங்குமிடத்தை நிர்வகிக்கலாம்."
    }
  },
  {
    id: 'profile_update',
    patterns: ['update profile', 'change name', 'change phone', 'edit profile'],
    role: 'all',
    response: {
      en: "Go to 'Profile' in the menu to update your personal details, contact information, and preferences.",
      ta: "உங்கள் தனிப்பட்ட விவரங்கள், தொடர்புத் தகவல் மற்றும் விருப்பங்களைப் புதுப்பிக்க மெனுவில் உள்ள 'Profile' பகுதிக்குச் செல்லவும்."
    }
  },
  {
    id: 'security_deposit',
    patterns: ['deposit', 'advance', 'security amount', 'refund'],
    role: 'all',
    response: {
      en: "Security deposits are held by the owner and are typically refunded at the end of the tenancy, subject to deductions for damages or unpaid rent as per the agreement.",
      ta: "பாதுகாப்பு வைப்புத்தொகை உரிமையாளரிடம் இருக்கும். ஒப்பந்தத்தின்படி சேதங்கள் அல்லது நிலுவை வாடகைக்கான பிடித்தங்கள் போக, குத்தகை முடிவில் இது பொதுவாக திருப்பித் தரப்படும்."
    }
  },

  // --- OWNER QUESTIONS ---
  {
    id: 'add_property',
    patterns: ['how to add property', 'list property', 'new property', 'post ad', 'create listing'],
    role: 'owner',
    response: {
      en: "To add a property, go to your Dashboard, click on 'My Properties', and then click the 'Add Property' button. Fill in the details and submit.",
      ta: "சொத்தை சேர்க்க, உங்கள் டாஷ்போர்டிற்குச் சென்று, 'My Properties' என்பதைக் கிளிக் செய்து, பின்னர் 'Add Property' பொத்தானைக் கிளிக் செய்யவும்."
    }
  },
  {
    id: 'tenant_requests',
    patterns: ['view requests', 'accept tenant', 'reject tenant', 'applications'],
    role: 'owner',
    response: {
      en: "Check the 'Requests' tab in your Dashboard to see tenant applications. You can view their profiles and approve or reject them.",
      ta: "குத்தகைதாரர் விண்ணப்பங்களைப் பார்க்க உங்கள் டாஷ்போர்டில் உள்ள 'Requests' தாவலைச் சரிபார்க்கவும். அவர்களின் சுயவிவரங்களைப் பார்த்து ஏற்கலாம் அல்லது நிராகரிக்கலாம்."
    }
  },
  {
    id: 'rental_agreement',
    patterns: ['create agreement', 'lease agreement', 'contract', 'rental deed'],
    role: 'owner',
    response: {
      en: "You can generate a digital rental agreement once a tenant is approved. Go to the tenant's details and select 'Create Agreement'.",
      ta: "குத்தகைதாரர் அங்கீகரிக்கப்பட்டதும் டிஜிட்டல் வாடகை ஒப்பந்தத்தை உருவாக்கலாம். குத்தகைதாரரின் விவரங்களுக்குச் சென்று 'Create Agreement' என்பதைத் தேர்ந்தெடுக்கவும்."
    }
  },
  {
    id: 'edit_property',
    patterns: ['edit property', 'update property', 'change property details', 'modify property'],
    role: 'owner',
    response: {
      en: "To edit a property, go to 'My Properties', find the property card, and click the Edit icon (pencil) in the bottom right corner.",
      ta: "சொத்தை திருத்த, 'My Properties' பகுதிக்குச் சென்று, சொத்து அட்டையில் வலது கீழ் மூலையில் உள்ள திருத்து (பென்சில்) ஐகானைக் கிளிக் செய்யவும்."
    }
  },
  {
    id: 'delete_property',
    patterns: ['delete property', 'remove property', 'cancel listing'],
    role: 'owner',
    response: {
      en: "To delete a property, go to 'My Properties', find the property card, and click the Delete icon (trash can) in the bottom right corner. Confirm the action in the popup.",
      ta: "சொத்தை நீக்க, 'My Properties' பகுதிக்குச் சென்று, சொத்து அட்டையில் வலது கீழ் மூலையில் உள்ள நீக்கு (குப்பைத் தொட்டி) ஐகானைக் கிளிக் செய்யவும்."
    }
  },
  {
    id: 'verify_tenant',
    patterns: ['verify tenant', 'check tenant', 'tenant documents'],
    role: 'owner',
    response: {
      en: "You can verify tenant documents in the 'Requests' section of your Dashboard when a tenant applies for your property.",
      ta: "வாடகைதாரர் உங்கள் சொத்திற்கு விண்ணப்பிக்கும்போது, உங்கள் டாஷ்போர்டின் 'Requests' பிரிவில் ஆவணங்களை சரிபார்க்கலாம்."
    }
  },
  {
    id: 'collect_rent',
    patterns: ['collect rent', 'receive payment', 'rent payment'],
    role: 'owner',
    response: {
      en: "Rent payments are processed through the app. You will receive a notification when a tenant pays. You can track all payments in the 'Payments' tab.",
      ta: "வாடகை கட்டணங்கள் செயலி மூலம் செயலாக்கப்படுகின்றன. வாடகைதாரர் செலுத்தும்போது உங்களுக்கு அறிவிப்பு வரும். 'Payments' தாவலில் அனைத்து கட்டணங்களையும் கண்காணிக்கலாம்."
    }
  },

  // --- TENANT QUESTIONS ---
  {
    id: 'search_property',
    patterns: ['find house', 'search home', 'look for rent', 'browse properties', 'find flat', '2bhk', '3bhk'],
    role: 'tenant',
    response: {
      en: "Use the search on the Home page to find properties. You can filter by location, price, and property type.",
      ta: "சொத்துக்களைக் கண்டறிய முகப்புப் பக்கத்தில் உள்ள தேடலைப் பயன்படுத்தவும். இடம், விலை மற்றும் சொத்து வகையின் அடிப்படையில் வடிகட்டலாம்."
    }
  },
  {
    id: 'contact_owner',
    patterns: ['call owner', 'message owner', 'chat with owner', 'contact details', 'contact owner'],
    role: 'tenant',
    response: {
      en: "Open a property's details page. If you are interested, use the contact/chat option to reach the owner.",
      ta: "ஒரு சொத்தின் விவரங்கள் பக்கத்தைத் திறக்கவும். நீங்கள் ஆர்வமாக இருந்தால், உரிமையாளரை அணுக contact/chat விருப்பத்தைப் பயன்படுத்தவும்."
    }
  },
  {
    id: 'schedule_visit',
    patterns: ['visit property', 'see house', 'book appointment', 'schedule visit', 'book visit'],
    role: 'tenant',
    response: {
      en: "On the property details page, use the visit/schedule option to request a viewing time with the owner.",
      ta: "சொத்து விவரங்கள் பக்கத்தில், உரிமையாளரிடம் பார்வையிடும் நேரத்தைக் கோர visit/schedule விருப்பத்தைப் பயன்படுத்தவும்."
    }
  },
  {
    id: 'rent_due_date',
    patterns: ['rent due date', 'when due', 'due date', 'last date rent'],
    role: 'tenant',
    response: {
      en: "Your rent due date appears in Payments under the current month. You’ll also get reminders before due.",
      ta: "தற்போதைய மாதத்தின் கீழ் Payments பகுதியில் உங்கள் வாடகை கடைசி தேதி காட்டப்படும். கடைசி தேதிக்கு முன் நினைவூட்டல்கள் வரும்."
    }
  },
  {
    id: 'late_fee',
    patterns: ['late fee', 'penalty', 'fine for delay'],
    role: 'tenant',
    response: {
      en: "Late fees depend on your agreement. Check the Agreements tab or ask your owner for exact charges.",
      ta: "தாமத கட்டணம் உங்கள் ஒப்பந்தத்தைப் பொறுத்தது. சரியான கட்டணத்திற்காக Agreements தாவலைப் பார்க்கவும் அல்லது உரிமையாளரை கேளுங்கள்."
    }
  },
  {
    id: 'notice_period',
    patterns: ['notice period', 'how many days notice', 'notice to vacate'],
    role: 'tenant',
    response: {
      en: "Notice period is defined in your agreement (typically 30 days). See Agreements → Notice clause.",
      ta: "நோட்டீஸ் காலம் உங்கள் ஒப்பந்தத்தில் குறிப்பிடப்பட்டுள்ளது (பொதுவாக 30 நாட்கள்). Agreements → Notice விதியைப் பார்க்கவும்."
    }
  },
  {
    id: 'maintenance_sla',
    patterns: ['maintenance time', 'how long to fix', 'repair time', 'sla'],
    role: 'tenant',
    response: {
      en: "Fix times vary by issue severity. Track status in Rental Details → Maintenance after you raise a request.",
      ta: "சிக்கலின் தீவிரத்தின்படி சரிசெய்யும் நேரம் மாறும். கோரிக்கை சமர்ப்பித்ததும் Rental Details → Maintenance பகுதியில் நிலையைப் பாருங்கள்."
    }
  },
  {
    id: 'owner_response_time',
    patterns: ['owner response', 'how long owner respond', 'owner reply'],
    role: 'tenant',
    response: {
      en: "Owners typically respond within 24–48 hours. If delayed, you can send a reminder from the request.",
      ta: "உரிமையாளர்கள் பொதுவாக 24–48 மணிநேரத்திற்குள் பதிலளிப்பார்கள். தாமதமானால், கோரிக்கையிலிருந்து நினைவூட்டலை அனுப்பலாம்."
    }
  },
  {
    id: 'receipt_availability',
    patterns: ['when receipt available', 'receipt after payment', 'get receipt'],
    role: 'tenant',
    response: {
      en: "Rent receipts are available immediately after successful payment in Payments → Receipts.",
      ta: "கட்டணம் வெற்றிகரமாக நிறைவுபெற்றவுடன் Payments → Receipts பகுதியில் ரசீது உடனே கிடைக்கும்."
    }
  },
  {
    id: 'deposit_deductions',
    patterns: ['deposit deduction', 'advance deduction', 'what deductions'],
    role: 'tenant',
    response: {
      en: "Deductions are per your agreement (damages, unpaid rent, utilities). Check the agreement’s deductions clause.",
      ta: "கழிப்புகள் உங்கள் ஒப்பந்தப்படி (சேதம், நிலுவை வாடகை, உபயோக கட்டணங்கள்). ஒப்பந்தத்தின் கழிப்பு விதியைப் பார்க்கவும்."
    }
  },
  {
    id: 'pay_rent',
    patterns: ['how to pay rent', 'make payment', 'pay due'],
    role: 'tenant',
    response: {
      en: "To pay rent, go to your Dashboard, click on 'Payments', select the pending month, and proceed with the payment gateway.",
      ta: "வாடகை செலுத்த, உங்கள் டாஷ்போர்டிற்குச் சென்று, 'Payments' என்பதைக் கிளிக் செய்து, நிலுவை மாதத்தைத் தேர்ந்தெடுத்து கட்டணம் செலுத்தவும்."
    }
  },
  {
    id: 'raise_complaint',
    patterns: ['complaint', 'maintenance issue', 'repair', 'broken'],
    role: 'tenant',
    response: {
      en: "If you have a maintenance issue, go to the 'Rental Details' section, switch to the 'Maintenance' tab, and click 'Raise Request'.",
      ta: "பராமரிப்பு சிக்கல் இருந்தால், 'Rental Details' பகுதிக்குச் சென்று, 'Maintenance' தாவலுக்கு மாறி, 'Raise Request' என்பதைக் கிளிக் செய்யவும்."
    }
  },
  {
    id: 'vacate_process',
    patterns: ['how to vacate', 'move out', 'leave house', 'notice period'],
    role: 'tenant',
    response: {
      en: "To vacate, go to 'Rental Details', select the 'Vacate' tab, and submit a vacate request. The owner will be notified.",
      ta: "வெளியேற, 'Rental Details' பகுதிக்குச் சென்று, 'Vacate' தாவலைத் தேர்ந்தெடுத்து, வெளியேறும் கோரிக்கையைச் சமர்ப்பிக்கவும்."
    }
  },
  {
    id: 'download_agreement',
    patterns: ['download agreement', 'rental agreement', 'contract'],
    role: 'tenant',
    response: {
      en: "You can view and download your rental agreement from the 'Rental Details' section under the 'Agreements' tab.",
      ta: "'Rental Details' பிரிவில் 'Agreements' தாவலின் கீழ் உங்கள் வாடகை ஒப்பந்தத்தைப் பார்க்கலாம் மற்றும் பதிவிறக்கலாம்."
    }
  }
];

export function findKnowledge(query: string, userRole: string | undefined): KnowledgeItem | null {
  const normalizedQuery = query.toLowerCase();
  const relevantItems = KNOWLEDGE_BASE.filter(item => {
    if (item.role === 'all') return true;
    if (userRole === 'owners' || userRole === 'brokersBuilders') return item.role === 'owner';
    if (userRole === 'customers') return item.role === 'tenant';
    return false;
  });

  let best: { item: KnowledgeItem; score: number } | null = null;

  for (const item of relevantItems) {
    let count = 0;
    let longest = 0;
    for (const pattern of item.patterns) {
      const p = pattern.toLowerCase().trim();
      if (!p) continue;
      if (normalizedQuery.includes(p)) {
        count += 1;
        if (p.length > longest) longest = p.length;
      }
    }
    const score = count > 0 ? count * 100 + longest : 0;
    if (score > 0 && (!best || score > best.score)) {
      best = { item, score };
    }
  }

  return best ? best.item : null;
}
