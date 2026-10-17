import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useGetAllProperties, useGetCallerUserProfile } from '../hooks/useQueries';
import type { Property } from '../types';
import PropertyForm from '../components/PropertyForm';
import { useLanguage } from './LanguageContext';
import api from '../lib/api';
import { findKnowledge } from '../lib/chatbotKnowledge';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  translatedText?: string;
  displayTranslatedText?: string;
  detectedLanguage?: string;
  timestamp: Date;
  properties?: Property[];
}

type TranslationMeta = {
  translatedText?: string;
  displayTranslatedText?: string;
  detectedLanguage?: string;
};

interface AIContextType {
  messages: Message[];
  isProcessing: boolean;
  processMessage: (message: string, translation?: TranslationMeta) => Promise<void>;
  greetUser: () => void;
  addMessage: (
    role: 'user' | 'assistant',
    content: string,
    properties?: Property[],
    translation?: TranslationMeta
  ) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const { language, t } = useLanguage();
  
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: allProperties = [] } = useGetAllProperties();

  type ChatIntent =
    | 'ADD_PROPERTY'
    | 'PAY_RENT'
    | 'DOWNLOAD_RECEIPT'
    | 'CHECK_RENT_STATUS'
    | 'SEND_VACATE_REQUEST'
    | 'CHECK_VACATE_STATUS'
    | 'RAISE_MAINTENANCE'
    | 'CHECK_MAINTENANCE_STATUS'
    | 'APPROVE_PAYMENT'
    | 'CHECK_PAYMENT_REQUESTS'
    | 'CHECK_REQUEST_STATUS'
    | 'VIEW_TENANT_DETAILS'
    | 'UPLOAD_AGREEMENT_DOCUMENT'
    | 'AGREEMENT_HELP'
    | 'UPDATE_PROFILE'
    | 'GENERAL_HELP'
    | 'UNKNOWN';

  const isResideRelated = (message: string) => {
    const text = message.toLowerCase();
    const keywords = [
      'reside',
      'property',
      'rent',
      'tenant',
      'owner',
      'agreement',
      'maintenance',
      'vacate',
      'payment',
      'receipt',
      'dashboard',
      'profile',
      'request',
      'approve',
      'reject',
      'download',
      'upload',
      'login',
      'register',
      'deposit',
      'advance',
      'refund',
      'feature',
      'update',
      'change',
      'application',
      'search',
      'find',
      'contact',
      'visit',
      'schedule',
      'book',
      'support',
      'help',
      'password',
      'forgot'
    ];
    return keywords.some((k) => text.includes(k));
  };

  const isPropertySearchLike = (message: string) => {
    const text = message.toLowerCase();
    const propertyWords = [
      'flat',
      'apartment',
      'house',
      'villa',
      'pg',
      'land',
      'plot',
      '2bhk',
      '3bhk',
      'bhk',
      'rent',
      'buy',
      'purchase',
      'lease',
      'chennai',
      'coimbatore',
      'madurai',
      'salem',
      'trichy',
      'tiruchirappalli'
    ];
    return propertyWords.some((k) => text.includes(k));
  };

  const detectIntent = (message: string): ChatIntent => {
    const text = message.toLowerCase();

    if (text.includes('add property') || text.includes('list my house') || text.includes('list property')) {
      return 'ADD_PROPERTY';
    }
    if (
      (text.includes('rent') && (text.includes('status') || text.includes('due') || text.includes('pending') || text.includes('overdue') || text.includes('balance') || text.includes('owe'))) ||
      text.includes('my rent status')
    ) {
      return 'CHECK_RENT_STATUS';
    }
    if (text.includes('pay rent') || text.includes('rent payment') || text.includes('pay my rent')) {
      return 'PAY_RENT';
    }
    if ((text.includes('download') || text.includes('get') || text.includes('print')) && text.includes('receipt')) {
      return 'DOWNLOAD_RECEIPT';
    }
    if (text.includes('vacate') || text.includes('move out') || text.includes('leave the house')) {
      if (text.includes('status') || text.includes('pending') || text.includes('approved') || text.includes('rejected')) {
        return 'CHECK_VACATE_STATUS';
      }
      return 'SEND_VACATE_REQUEST';
    }
    if (text.includes('maintenance') || text.includes('repair') || text.includes('issue with') || text.includes('complaint')) {
      if (text.includes('status') || text.includes('pending') || text.includes('in progress') || text.includes('completed')) {
        return 'CHECK_MAINTENANCE_STATUS';
      }
      return 'RAISE_MAINTENANCE';
    }
    if ((text.includes('approve') || text.includes('reject')) && text.includes('payment')) {
      return 'APPROVE_PAYMENT';
    }
    if (text.includes('payment request') || (text.includes('payment') && text.includes('pending'))) {
      return 'CHECK_PAYMENT_REQUESTS';
    }
    if (text.includes('request status') || (text.includes('my') && text.includes('request'))) {
      return 'CHECK_REQUEST_STATUS';
    }
    if (text.includes('tenant details') || text.includes('view tenant') || text.includes('see tenant')) {
      return 'VIEW_TENANT_DETAILS';
    }
    if (text.includes('upload') && text.includes('agreement')) {
      return 'UPLOAD_AGREEMENT_DOCUMENT';
    }
    if (text.includes('agreement') && (text.includes('download') || text.includes('view') || text.includes('document') || text.includes('upload'))) {
      return 'AGREEMENT_HELP';
    }
    if (text.includes('update profile') || text.includes('edit profile') || text.includes('change my details')) {
      return 'UPDATE_PROFILE';
    }
    if (text.includes('help') || text.includes('what can you do')) {
      return 'GENERAL_HELP';
    }

    return 'UNKNOWN';
  };

  useEffect(() => {
    setMessages([]);
    setShowPropertyForm(false);
  }, [userProfile?.id]);

  const speak = useCallback((text: string, lang: 'en' | 'ta') => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string, properties?: Property[], translation?: TranslationMeta) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      translatedText: translation?.translatedText,
      displayTranslatedText: translation?.displayTranslatedText,
      detectedLanguage: translation?.detectedLanguage,
      timestamp: new Date(),
      properties,
    };
    setMessages((prev) => [...prev, newMessage]);
    
    if (role === 'assistant') {
      speak(content, language);
    }
  }, [language, speak]);

  const greetUser = useCallback(() => {
    let greeting = '';

    if (!userProfile) {
      greeting = t(
        'Hello! I am your AI assistant. Tell me what kind of property you are looking for or say "add property" if you want to list one.',
        'வணக்கம்! நான் உங்கள் AI உதவியாளர். நீங்கள் எந்த வகையான சொத்தை தேடுகிறீர்கள் என்பதை அல்லது சொத்து சேர்க்க விரும்பினால் "சொத்து சேர்" என்று சொல்லுங்கள்.'
      );
    } else {
      const role = userProfile.role;

      if (role === 'owners' || role === 'brokersBuilders') {
        greeting = t(
          `Hello ${userProfile.name}! Would you like to add a property? Say "add property".`,
          `வணக்கம் ${userProfile.name}! நீங்கள் சொத்து சேர்க்க விரும்புகிறீர்களா? "சொத்து சேர்" என்று சொல்லுங்கள்.`
        );
      } else if (role === 'customers') {
        greeting = t(
          `Hello ${userProfile.name}! What type of property are you looking for? Tell me your budget, location, and preferences.`,
          `வணக்கம் ${userProfile.name}! நீங்கள் என்ன வகையான சொத்தை தேடுகிறீர்கள்? உங்கள் பட்ஜெட், இடம் மற்றும் விருப்பங்களை சொல்லுங்கள்.`
        );
      } else {
        greeting = t(
          `Hello ${userProfile.name}! How can I help you today?`,
          `வணக்கம் ${userProfile.name}! இன்று நான் உங்களுக்கு எப்படி உதவலாம்?`
        );
      }
    }

    if (greeting) {
      addMessage('assistant', greeting);
    }
  }, [userProfile, t, addMessage]);

  const searchProperties = (criteria: any): Property[] => {
    return allProperties.filter((property) => {
      if (criteria.type && property.type !== criteria.type) return false;
      if (criteria.transactionType && property.transactionType !== criteria.transactionType) return false;
      if (criteria.location && !property.location.toLowerCase().includes(criteria.location.toLowerCase())) return false;
      if (criteria.maxPrice && Number(property.price) > criteria.maxPrice) return false;
      if (criteria.minPrice && Number(property.price) < criteria.minPrice) return false;
      return true;
    });
  };

  const extractSearchCriteria = (message: string) => {
    const lowerMessage = message.toLowerCase();
    const criteria: any = {};
    
    // Extract property type
    if (lowerMessage.includes('flat') || lowerMessage.includes('apartment') || lowerMessage.includes('பிளாட்')) {
      criteria.type = 'flat';
    } else if (lowerMessage.includes('house') || lowerMessage.includes('villa') || lowerMessage.includes('வீடு')) {
      criteria.type = 'house';
    } else if (lowerMessage.includes('pg') || lowerMessage.includes('பி.ஜி')) {
      criteria.type = 'pg';
    } else if (lowerMessage.includes('land') || lowerMessage.includes('plot') || lowerMessage.includes('நிலம்')) {
      criteria.type = 'land';
    }
    
    // Extract transaction type
    if (lowerMessage.includes('rent') || lowerMessage.includes('lease') || lowerMessage.includes('வாடகை')) {
      criteria.transactionType = 'rent';
    } else if (lowerMessage.includes('buy') || lowerMessage.includes('purchase') || lowerMessage.includes('வாங்க')) {
      criteria.transactionType = 'purchase';
    }
    
    // Extract location
    const cities = ['chennai', 'coimbatore', 'madurai', 'salem', 'trichy', 'tiruchirappalli'];
    for (const city of cities) {
      if (lowerMessage.includes(city)) {
        criteria.location = city;
        break;
      }
    }
    
    // Extract price
    const priceMatch = message.match(/(\d+)\s*(lakh|lakhs|crore|crores|l|cr|k)?/i);
    if (priceMatch) {
      let price = parseInt(priceMatch[1]);
      const unit = priceMatch[2]?.toLowerCase();
      
      if (unit?.startsWith('cr')) {
        price *= 10000000;
      } else if (unit?.startsWith('l')) {
        price *= 100000;
      } else if (unit === 'k') {
        price *= 1000;
      }
      
      criteria.maxPrice = price * 1.2;
      criteria.minPrice = price * 0.8;
    }
    
    return criteria;
  };

  const processMessage = useCallback(
    async (message: string, translation?: TranslationMeta) => {
      setIsProcessing(true);
      const processingText =
        typeof translation?.translatedText === 'string' && translation.translatedText.trim()
          ? translation.translatedText
          : message;

      addMessage('user', message, undefined, translation);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const role = userProfile?.role;
      const intent = detectIntent(processingText);

      // Check Knowledge Base first
      const knowledgeMatch = findKnowledge(processingText, role);
      if (knowledgeMatch) {
        addMessage(
          'assistant',
          language === 'ta' ? knowledgeMatch.response.ta : knowledgeMatch.response.en
        );
        setIsProcessing(false);
        return;
      }

      const normalized = processingText.trim().toLowerCase();
      const isGreeting =
        normalized === 'hi' ||
        normalized === 'hello' ||
        normalized === 'hey' ||
        normalized.startsWith('hi ') ||
        normalized.startsWith('hello ') ||
        normalized.startsWith('hey ') ||
        normalized.includes('good morning') ||
        normalized.includes('good evening') ||
        normalized.includes('good afternoon');
      const isThanks = normalized.includes('thank');

      if (isGreeting || isThanks) {
        if (role === 'owners' || role === 'brokersBuilders') {
          addMessage(
            'assistant',
            t(
              'Hi! I can help you add properties, review rent/buy requests, check payment requests, manage agreements, and update your profile. What would you like to do?',
              'வணக்கம்! சொத்துகளை சேர்க்க, வாடகை/வாங்க கோரிக்கைகளை பார்க்க, payment requests-ஐ சரிபார்க்க, agreements-ஐ நிர்வகிக்க மற்றும் உங்கள் profile-ஐ புதுப்பிக்க நான் உதவ முடியும். நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?'
            )
          );
          setIsProcessing(false);
          return;
        }

        if (!role || role === 'customers') {
          addMessage(
            'assistant',
            t(
              'Hi! Tell me your location and budget to search properties, or ask about rent, receipts, maintenance, vacate, agreements, or your profile.',
              'வணக்கம்! சொத்துகளை தேட உங்கள் இடம் மற்றும் பட்ஜெட்டை சொல்லுங்கள், அல்லது வாடகை, ரசீது, பராமரிப்பு, வெளியேறு, ஒப்பந்தம், profile பற்றி கேளுங்கள்.'
            )
          );
          setIsProcessing(false);
          return;
        }

        addMessage(
          'assistant',
          t(
            'Hi! I can guide you through RESIDE features. Tell me what you want to do.',
            'வணக்கம்! RESIDE அம்சங்களை பயன்படுத்த உங்களுக்கு வழிகாட்ட முடியும். நீங்கள் என்ன செய்ய விரும்புகிறீர்கள் என்று சொல்லுங்கள்.'
          )
        );
        setIsProcessing(false);
        return;
      }

      if (!isResideRelated(processingText) && !isPropertySearchLike(processingText)) {
        addMessage(
          'assistant',
          t(
            'I can only help with rental and property management questions inside RESIDE.',
            'நான் RESIDE அமைப்பில் வாடகை மற்றும் சொத்து மேலாண்மை தொடர்பான கேள்விகளுக்கே பதிலளிக்க முடியும்.'
          )
        );
        setIsProcessing(false);
        return;
      }

      if (intent === 'UNKNOWN' && !isPropertySearchLike(processingText)) {
        if (!role || role === 'customers') {
          addMessage(
            'assistant',
            t(
              'Tell me location and budget to search, or say: pay rent, receipt, maintenance, vacate, agreement, profile.',
              'தேட இடம் மற்றும் பட்ஜெட்டை சொல்லுங்கள், அல்லது: வாடகை செலுத்த, ரசீது, பராமரிப்பு, வெளியேறு, ஒப்பந்தம், profile என்று கூறுங்கள்.'
            )
          );
        } else if (role === 'owners' || role === 'brokersBuilders') {
          addMessage(
            'assistant',
            t(
              'Say: add property, payment requests, tenant details, agreements, or profile.',
              'சொத்து சேர், payment requests, tenant details, agreements, அல்லது profile என்று கூறுங்கள்.'
            )
          );
        } else {
          addMessage(
            'assistant',
            t('Please rephrase your question.', 'தயவுசெய்து உங்கள் கேள்வியை மறுபடியும் எழுதவும்.')
          );
        }
        setIsProcessing(false);
        return;
      }

      const handleTenant = async () => {
        if (intent === 'APPROVE_PAYMENT' || intent === 'CHECK_PAYMENT_REQUESTS' || intent === 'VIEW_TENANT_DETAILS') {
          addMessage(
            'assistant',
            t(
              'That action is only available for owners in RESIDE.',
              'இந்த செயல் RESIDE-ல் உரிமையாளர்களுக்கு மட்டுமே கிடைக்கும்.'
            )
          );
          return;
        }

        if (intent === 'CHECK_RENT_STATUS') {
          try {
            const res = await api.get('/payments/tenant/records');
            const records = Array.isArray(res.data) ? res.data : [];
            if (records.length === 0) {
              addMessage(
                'assistant',
                t(
                  'No rent records found yet for your account.',
                  'உங்கள் கணக்கில் இன்னும் வாடகை பதிவுகள் இல்லை.'
                )
              );
              return;
            }

            const sorted = [...records].sort((a: any, b: any) => {
              const da = a?.month ? new Date(a.month).getTime() : 0;
              const db = b?.month ? new Date(b.month).getTime() : 0;
              return db - da;
            });
            const latest = sorted[0];
            const monthLabel = latest?.month ? new Date(latest.month).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : 'this month';
            const status = String(latest?.status || '').toLowerCase();
            const balance = Number(latest?.balance ?? 0);
            const dueDateText = latest?.dueDate ? new Date(latest.dueDate).toLocaleDateString() : '';

            if (status === 'paid' || balance === 0) {
              addMessage(
                'assistant',
                t(
                  `Your rent for ${monthLabel} is paid.`,
                  `${monthLabel} மாதத்திற்கான உங்கள் வாடகை செலுத்தப்பட்டுள்ளது.`
                )
              );
              return;
            }

            addMessage(
              'assistant',
              t(
                `Your rent for ${monthLabel} is ${status || 'pending'}. Balance: ₹${balance.toLocaleString()}${dueDateText ? ` (Due: ${dueDateText})` : ''}. Open your Payments tab to pay.`,
                `${monthLabel} மாதத்திற்கான உங்கள் வாடகை ${status || 'pending'} நிலையில் உள்ளது. நிலுவை: ₹${balance.toLocaleString()}${dueDateText ? ` (கடைசி தேதி: ${dueDateText})` : ''}. செலுத்த Payments தாளைத் திறக்கவும்.`
              )
            );
            return;
          } catch {
            addMessage(
              'assistant',
              t(
                'I could not fetch your rent status right now. Please open the Payments tab in your dashboard.',
                'தற்போது உங்கள் வாடகை நிலையை பெற முடியவில்லை. தயவுசெய்து டாஷ்போர்டில் Payments தாளைத் திறக்கவும்.'
              )
            );
            return;
          }
        }

        if (intent === 'DOWNLOAD_RECEIPT') {
          try {
            const res = await api.get('/payments/tenant/records');
            const records = Array.isArray(res.data) ? res.data : [];
            const target =
              records.find((r: any) => r.status === 'paid' && r.balance === 0) ||
              records[0];

            if (!target) {
              addMessage(
                'assistant',
                t(
                  'I could not find any rent payments for your account yet.',
                  'உங்கள் கணக்கில் எந்தவொரு வாடகை கட்டணமும் இன்னும் இல்லை.'
                )
              );
              return;
            }

            const approvedPayment = (target.payments || []).find(
              (p: any) => p.status === 'approved'
            );

            if (!approvedPayment) {
              addMessage(
                'assistant',
                t(
                  'Your payment has been submitted but not yet approved by the owner. Once it is approved, you can download the receipt from your Payments tab.',
                  'உங்கள் கட்டணம் சமர்ப்பிக்கப்பட்டுள்ளது, ஆனால் இன்னும் உரிமையாளராகியவர் அங்கீகரிக்கவில்லை. அங்கீகரிக்கப்பட்டதும், உங்கள் Payments பகுதியில் இருந்து ரசீதைக் பதிவிறக்கலாம்.'
                )
              );
              return;
            }

            addMessage(
              'assistant',
              t(
                'Your latest rent payment is approved. Open your dashboard, go to Payments and click "Download Receipt" for that month.',
                'உங்கள் சமீபத்திய வாடகை கட்டணம் அங்கீகரிக்கப்பட்டது. உங்கள் டாஷ்போர்டில் Payments பகுதியில் சென்று அந்த மாதத்திற்கான "ரசீது பதிவிறக்கவும்" ஐ கிளிக் செய்யுங்கள்.'
              )
            );
            return;
          } catch {
            addMessage(
              'assistant',
              t(
                'I had trouble checking your payment status. Please open the Payments tab to verify your receipt.',
                'கட்டண நிலையைச் சரிபார்க்கும்போது சிக்கல் ஏற்பட்டது. தயவுசெய்து Payments பகுதியில் சென்று சரிபார்க்கவும்.'
              )
            );
            return;
          }
        }

        if (intent === 'CHECK_MAINTENANCE_STATUS') {
          try {
            const res = await api.get('/requests/maintenance/tenant');
            const reqs = Array.isArray(res.data) ? res.data : [];
            const pending = reqs.filter((r: any) => r.status === 'pending').length;
            const inProgress = reqs.filter((r: any) => r.status === 'in-progress').length;
            const completed = reqs.filter((r: any) => r.status === 'completed').length;

            addMessage(
              'assistant',
              t(
                `Your maintenance requests: Pending ${pending}, In progress ${inProgress}, Completed ${completed}. Open your Rental Details → Maintenance tab to view or create requests.`,
                `உங்கள் பராமரிப்பு கோரிக்கைகள்: நிலுவை ${pending}, செயல்பாட்டில் ${inProgress}, முடிந்தது ${completed}. பார்க்க/உருவாக்க Rental Details → Maintenance தாளைத் திறக்கவும்.`
              )
            );
            return;
          } catch {
            addMessage(
              'assistant',
              t(
                'I could not fetch your maintenance requests right now. Please open Rental Details → Maintenance.',
                'தற்போது உங்கள் பராமரிப்பு கோரிக்கைகளை பெற முடியவில்லை. தயவுசெய்து Rental Details → Maintenance தாளைத் திறக்கவும்.'
              )
            );
            return;
          }
        }

        if (intent === 'CHECK_VACATE_STATUS') {
          try {
            const res = await api.get('/vacate-request/my');
            const items = Array.isArray(res.data) ? res.data : [];
            if (items.length === 0) {
              addMessage(
                'assistant',
                t(
                  'You do not have any vacate requests yet.',
                  'உங்களிடம் எந்தவொரு வெளியேறும் கோரிக்கையும் இன்னும் இல்லை.'
                )
              );
              return;
            }
            const latest = items[0];
            const status = latest?.status || 'pending';
            const dateText = latest?.requestedVacateDate ? new Date(latest.requestedVacateDate).toLocaleDateString() : '';
            addMessage(
              'assistant',
              t(
                `Your latest vacate request status is "${status}"${dateText ? ` (Requested date: ${dateText})` : ''}. Open Rental Details → Vacate for full details.`,
                `உங்கள் சமீபத்திய வெளியேறும் கோரிக்கையின் நிலை "${status}"${dateText ? ` (கோரிய தேதி: ${dateText})` : ''}. முழு விவரங்களுக்கு Rental Details → Vacate தாளைத் திறக்கவும்.`
              )
            );
            return;
          } catch {
            addMessage(
              'assistant',
              t(
                'I could not fetch your vacate request status right now. Please open Rental Details → Vacate.',
                'தற்போது உங்கள் வெளியேறும் கோரிக்கை நிலையை பெற முடியவில்லை. தயவுசெய்து Rental Details → Vacate தாளைத் திறக்கவும்.'
              )
            );
            return;
          }
        }

        if (intent === 'CHECK_REQUEST_STATUS') {
          try {
            const res = await api.get('/requests/tenant');
            const reqs = Array.isArray(res.data) ? res.data : [];
            const pending = reqs.filter((r: any) => r.status === 'pending').length;
            const approved = reqs.filter((r: any) => r.status === 'approved').length;
            const rejected = reqs.filter((r: any) => r.status === 'rejected').length;

            addMessage(
              'assistant',
              t(
                `Your property requests: Pending ${pending}, Approved ${approved}, Rejected ${rejected}. You can review them in your dashboard Requests section.`,
                `உங்கள் சொத்து கோரிக்கைகள்: நிலுவை ${pending}, அங்கீகரிக்கப்பட்டது ${approved}, நிராகரிக்கப்பட்டது ${rejected}. உங்கள் டாஷ்போர்டில் Requests பகுதியில் அவற்றை பார்க்கலாம்.`
              )
            );
            return;
          } catch {
            addMessage(
              'assistant',
              t(
                'I could not fetch your request status right now. Please check your dashboard Requests section.',
                'தற்போது உங்கள் கோரிக்கை நிலையை பெற முடியவில்லை. தயவுசெய்து டாஷ்போர்டில் Requests பகுதியைப் பாருங்கள்.'
              )
            );
            return;
          }
        }

        if (intent === 'AGREEMENT_HELP') {
          addMessage(
            'assistant',
            t(
              'To view your rental agreement, open your dashboard and go to Agreements. You can view and download documents from the agreement dialog.',
              'உங்கள் வாடகை ஒப்பந்தத்தை பார்க்க, டாஷ்போர்டில் Agreements பகுதியில் செல்லவும். Agreement dialog-ல் இருந்து ஆவணங்களை பார்க்கவும் பதிவிறக்கவும் முடியும்.'
            )
          );
          return;
        }

        if (intent === 'PAY_RENT') {
          addMessage(
            'assistant',
            t(
              'To pay rent, open your dashboard, go to your rental details and click "Pay Now" for the current month.',
              'வாடகை செலுத்த, உங்கள் டாஷ்போர்டில் Rental Details பகுதியில் சென்று தற்போதைய மாதத்திற்கான "இப்போது செலுத்தவும்" ஐ அழுத்தவும்.'
            )
          );
          return;
        }

        if (intent === 'SEND_VACATE_REQUEST') {
          addMessage(
            'assistant',
            t(
              'To send a vacate request, open your rental details and use the Vacate tab to submit the request.',
              'வெளியேறும் கோரிக்கையை அனுப்ப, உங்கள் Rental Details பகுதியில் உள்ள Vacate தாளைத் திறந்து கோரிக்கையை சமர்ப்பிக்கவும்.'
            )
          );
          return;
        }

        if (intent === 'RAISE_MAINTENANCE') {
          addMessage(
            'assistant',
            t(
              'To raise a maintenance request, go to your dashboard, open your rental and use the Maintenance tab to describe the issue.',
              'பராமரிப்பு கோரிக்கையை எழுப்ப, உங்கள் டாஷ்போர்டில் Rental Details பகுதியில் உள்ள Maintenance தாளில் உங்கள் பிரச்சினையை விளக்கவும்.'
            )
          );
          return;
        }

        if (intent === 'UPDATE_PROFILE') {
          addMessage(
            'assistant',
            t(
              'To update your profile, open the Settings tab in your dashboard and edit your personal details.',
              'உங்கள் Profile-ஐ மாற்ற, டாஷ்போர்டில் Settings தாளில் சென்று உங்கள் தனிப்பட்ட விவரங்களை திருத்தவும்.'
            )
          );
          return;
        }

        if (intent === 'GENERAL_HELP') {
          addMessage(
            'assistant',
            t(
              'I can help you search properties, request a property, pay rent, check rent/receipt status, submit maintenance or vacate requests, and update your profile.',
              'நான் உங்களுக்கு சொத்துகளை தேட, சொத்து கோரிக்கை அனுப்ப, வாடகை செலுத்த, வாடகை/ரசீது நிலை பார்க்க, பராமரிப்பு அல்லது வெளியேறும் கோரிக்கைகளை சமர்ப்பிக்க மற்றும் உங்கள் Profile-ஐ புதுப்பிக்க உதவ முடியும்.'
            )
          );
          return;
        }

        const criteria = extractSearchCriteria(processingText);
        const results = searchProperties(criteria);

        if (results.length > 0) {
          const response = t(
            `Found ${results.length} properties:`,
            `${results.length} சொத்துகள் கிடைத்துள்ளன:`
          );
          addMessage('assistant', response, results);
        } else {
          const response = t(
            'Sorry, no properties match your requirements. Try different criteria.',
            'மன்னிக்கவும், உங்கள் தேவைக்கு பொருந்தும் சொத்துகள் எதுவும் இல்லை. வேறு விருப்பங்களை முயற்சிக்கவும்.'
          );
          addMessage('assistant', response);
        }
      };

      const handleOwner = async () => {
        if (intent === 'PAY_RENT' || intent === 'DOWNLOAD_RECEIPT' || intent === 'SEND_VACATE_REQUEST') {
          addMessage(
            'assistant',
            t(
              'That action is intended for tenants in RESIDE.',
              'இந்த செயல் RESIDE-ல் குத்தகைதாரர்களுக்கானது.'
            )
          );
          return;
        }

        if (intent === 'ADD_PROPERTY') {
          setShowPropertyForm(true);
          addMessage(
            'assistant',
            t(
              'Please fill out the form to add your property.',
              'தயவுசெய்து படிவத்தை நிரப்பி உங்கள் சொத்தைச் சேர்க்கவும்.'
            )
          );
          return;
        }

        if (intent === 'CHECK_PAYMENT_REQUESTS') {
          try {
            const res = await api.get('/payments/owner/requests');
            const reqs = Array.isArray(res.data) ? res.data : [];
            addMessage(
              'assistant',
              t(
                `You currently have ${reqs.length} pending payment request(s). Open Owner Dashboard → Overview to review them.`,
                `தற்போது உங்களிடம் ${reqs.length} நிலுவை கட்டண கோரிக்கைகள் உள்ளன. அவற்றை பார்க்க Owner Dashboard → Overview-க்கு செல்லவும்.`
              )
            );
            return;
          } catch {
            addMessage(
              'assistant',
              t(
                'I could not fetch payment requests right now. Please check the Owner Dashboard overview.',
                'தற்போது கட்டண கோரிக்கைகளை பெற முடியவில்லை. தயவுசெய்து Owner Dashboard overview-ஐ பார்க்கவும்.'
              )
            );
            return;
          }
        }

        if (intent === 'CHECK_MAINTENANCE_STATUS') {
          try {
            const res = await api.get('/requests/maintenance/owner');
            const reqs = Array.isArray(res.data) ? res.data : [];
            const pending = reqs.filter((r: any) => r.status === 'pending').length;
            const inProgress = reqs.filter((r: any) => r.status === 'in-progress').length;
            addMessage(
              'assistant',
              t(
                `Maintenance requests: Pending ${pending}, In progress ${inProgress}. Open a property and go to Maintenance tab for details.`,
                `பராமரிப்பு கோரிக்கைகள்: நிலுவை ${pending}, செயல்பாட்டில் ${inProgress}. விவரங்களுக்கு ஒரு சொத்தைத் திறந்து Maintenance தாளுக்கு செல்லவும்.`
              )
            );
            return;
          } catch {
            addMessage(
              'assistant',
              t(
                'I could not fetch maintenance requests right now. Please open a property and check Maintenance tab.',
                'தற்போது பராமரிப்பு கோரிக்கைகளை பெற முடியவில்லை. தயவுசெய்து ஒரு சொத்தைத் திறந்து Maintenance தாளை பார்க்கவும்.'
              )
            );
            return;
          }
        }

        if (intent === 'CHECK_REQUEST_STATUS') {
          try {
            const res = await api.get('/requests/owner');
            const reqs = Array.isArray(res.data) ? res.data : [];
            const pendingRent = reqs.filter((r: any) => r.type === 'rent' && r.status === 'pending').length;
            const pendingBuy = reqs.filter((r: any) => r.type === 'buy' && r.status === 'pending').length;
            addMessage(
              'assistant',
              t(
                `You have pending requests: Rent ${pendingRent}, Buy ${pendingBuy}. Open Owner Dashboard → Requests to review and respond.`,
                `உங்களிடம் நிலுவை கோரிக்கைகள்: வாடகை ${pendingRent}, வாங்க ${pendingBuy}. பதிலளிக்க Owner Dashboard → Requests-க்கு செல்லவும்.`
              )
            );
            return;
          } catch {
            addMessage(
              'assistant',
              t(
                'I could not fetch your property requests right now. Please open Owner Dashboard → Requests.',
                'தற்போது உங்கள் சொத்து கோரிக்கைகளை பெற முடியவில்லை. தயவுசெய்து Owner Dashboard → Requests-க்கு செல்லவும்.'
              )
            );
            return;
          }
        }

        if (intent === 'AGREEMENT_HELP') {
          addMessage(
            'assistant',
            t(
              'To manage agreements, open a property from My Properties and go to the Agreements tab. You can view tenant details and documents there.',
              'ஒப்பந்தங்களை நிர்வகிக்க, My Properties-ல் இருந்து ஒரு சொத்தைத் திறந்து Agreements தாளுக்கு செல்லவும். அங்கே குத்தகைதாரர் விவரங்களும் ஆவணங்களும் இருக்கும்.'
            )
          );
          return;
        }

        if (intent === 'APPROVE_PAYMENT') {
          try {
            const res = await api.get('/payments/owner/requests');
            const requests = Array.isArray(res.data) ? res.data : [];
            if (requests.length === 0) {
              addMessage(
                'assistant',
                t(
                  'You do not have any pending payment requests right now.',
                  'தற்போது உங்களிடம் நிலுவையில் உள்ள கட்டண கோரிக்கைகள் இல்லை.'
                )
              );
            } else {
              addMessage(
                'assistant',
                t(
                  `You have ${requests.length} pending payment request(s). Open your dashboard and use the Payment Requests section to approve or reject them.`,
                  `உங்களிடம் ${requests.length} நிலுவை கட்டண கோரிக்கைகள் உள்ளன. உங்கள் டாஷ்போர்டில் Payment Requests பகுதியில் சென்று அவற்றை அங்கீகரிக்க அல்லது நிராகரிக்கவும்.`
                )
              );
            }
            return;
          } catch {
            addMessage(
              'assistant',
              t(
                'I could not check your payment requests. Please open the Owner Dashboard to manage them.',
                'உங்கள் Payment Requests-ஐ சரிபார்க்க முடியவில்லை. Owner Dashboard-ல் சென்று அவற்றை நிர்வகிக்கவும்.'
              )
            );
            return;
          }
        }

        if (intent === 'VIEW_TENANT_DETAILS') {
          addMessage(
            'assistant',
            t(
              'To view tenant details, open a property in your dashboard and check the Tenant section.',
              'குத்தகைதாரர் விவரங்களை பார்க்க, உங்கள் டாஷ்போர்டில் ஒரு சொத்தைத் திறந்து Tenant பகுதியைப் பாருங்கள்.'
            )
          );
          return;
        }

        if (intent === 'UPLOAD_AGREEMENT_DOCUMENT') {
          addMessage(
            'assistant',
            t(
              'To upload an agreement document, open the Agreements section for the property and use the upload option.',
              'ஒப்பந்த ஆவணத்தைப் பதிவேற்ற, அந்த சொத்தின் Agreements பகுதியில் சென்று upload விருப்பத்தைப் பயன்படுத்தவும்.'
            )
          );
          return;
        }

        if (intent === 'UPDATE_PROFILE') {
          addMessage(
            'assistant',
            t(
              'To update your profile, open the Settings tab in your dashboard and edit your information.',
              'உங்கள் Profile-ஐ மாற்ற, டாஷ்போர்டில் Settings தாளில் சென்று உங்கள் தகவல்களைத் திருத்தவும்.'
            )
          );
          return;
        }

        if (intent === 'GENERAL_HELP') {
          addMessage(
            'assistant',
            t(
              'I can help you add properties, review rent/buy requests, check maintenance and payment requests, view tenant details, and manage agreements.',
              'நான் உங்களுக்கு சொத்துகளைச் சேர்க்க, வாடகை/வாங்க கோரிக்கைகளை பார்க்க, பராமரிப்பு மற்றும் கட்டண கோரிக்கைகளை சரிபார்க்க, Tenant விவரங்களைப் பார்வையிட மற்றும் Agreements-ஐ நிர்வகிக்க உதவ முடியும்.'
            )
          );
          return;
        }

        addMessage(
          'assistant',
          t(
            'As an owner, you can ask me to add a property, check payment requests, or view tenant details for your properties.',
            'ஒரு உரிமையாளராக, நீங்கள் சொத்தைச் சேர்க்க, Payment Requests-ஐ பார்க்க அல்லது உங்கள் சொத்துகளுக்கான Tenant விவரங்களை அறிய என்னைக் கேட்கலாம்.'
          )
        );
      };

      try {
        if (!role || role === 'customers') {
          await handleTenant();
        } else if (role === 'owners' || role === 'brokersBuilders') {
          await handleOwner();
        } else {
          addMessage(
            'assistant',
            t(
              'I could not determine your role. Please log in again and try.',
              'உங்கள் பங்கு என்ன என்பதை கண்டறிய முடியவில்லை. தயவுசெய்து மீண்டும் உள்நுழைந்து முயற்சிக்கவும்.'
            )
          );
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [userProfile, t, addMessage, allProperties]
  );

  return (
    <AIContext.Provider
      value={{
        messages,
        isProcessing,
        processMessage,
        greetUser,
        addMessage,
      }}
    >
      {children}
      <PropertyForm open={showPropertyForm} onOpenChange={setShowPropertyForm} />
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within AIProvider');
  }
  return context;
}
