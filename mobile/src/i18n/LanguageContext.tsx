import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export type AppLanguage = 'pt' | 'en' | 'fr' | 'es';

const translations = {
  'nav.home': { pt: 'Início', en: 'Home', fr: 'Accueil', es: 'Inicio' },
  'nav.profile': { pt: 'Perfil', en: 'Profile', fr: 'Profil', es: 'Perfil' },
  'nav.readings': { pt: 'Medições', en: 'Readings', fr: 'Mesures', es: 'Mediciones' },
  'nav.notifications': { pt: 'Avisos', en: 'Alerts', fr: 'Alertes', es: 'Avisos' },
  'nav.settings': { pt: 'Definições', en: 'Settings', fr: 'Paramètres', es: 'Ajustes' },
  'home.hello': { pt: 'Olá', en: 'Hello', fr: 'Bonjour', es: 'Hola' },
  'home.question': { pt: 'O que queres fazer hoje?', en: 'What would you like to do today?', fr: 'Que souhaitez-vous faire aujourd’hui ?', es: '¿Qué quieres hacer hoy?' },
  'home.quick': { pt: 'Ações rápidas', en: 'Quick actions', fr: 'Actions rapides', es: 'Acciones rápidas' },
  'home.triage': { pt: 'Orientação de saúde', en: 'Health guidance', fr: 'Orientation santé', es: 'Orientación de salud' },
  'home.book': { pt: 'Marcar consulta', en: 'Book consultation', fr: 'Prendre rendez-vous', es: 'Reservar consulta' },
  'home.prescription': { pt: 'Pedir receita', en: 'Request prescription', fr: 'Demander une ordonnance', es: 'Solicitar receta' },
  'home.measurements': { pt: 'As minhas medições', en: 'My measurements', fr: 'Mes mesures', es: 'Mis mediciones' },
  'home.family': { pt: 'Família', en: 'Family', fr: 'Famille', es: 'Familia' },
  'home.portal': { pt: 'Portal completo', en: 'Full portal', fr: 'Portail complet', es: 'Portal completo' },
  'home.portal_desc': { pt: 'Acede ao histórico clínico completo, documentos e consultas passadas.', en: 'Access your complete clinical history, documents, and past consultations.', fr: 'Accédez à votre historique clinique, vos documents et consultations passées.', es: 'Accede a tu historial clínico, documentos y consultas anteriores.' },
  'home.profile_cta': { pt: 'Ver o meu perfil →', en: 'View my profile →', fr: 'Voir mon profil →', es: 'Ver mi perfil →' },
  'common.sign_out': { pt: 'Sair', en: 'Sign out', fr: 'Déconnexion', es: 'Salir' },
  'settings.title': { pt: 'Definições', en: 'Settings', fr: 'Paramètres', es: 'Ajustes' },
  'settings.language': { pt: 'Idioma', en: 'Language', fr: 'Langue', es: 'Idioma' },
  'settings.account': { pt: 'Conta', en: 'Account', fr: 'Compte', es: 'Cuenta' },
  'settings.name': { pt: 'Nome', en: 'Name', fr: 'Nom', es: 'Nombre' },
  'settings.role': { pt: 'Função', en: 'Role', fr: 'Rôle', es: 'Rol' },
  'settings.password': { pt: 'Alterar palavra-passe', en: 'Change password', fr: 'Changer le mot de passe', es: 'Cambiar contraseña' },
  'settings.current_password': { pt: 'Palavra-passe atual', en: 'Current password', fr: 'Mot de passe actuel', es: 'Contraseña actual' },
  'settings.new_password': { pt: 'Nova palavra-passe (mín. 6 caracteres)', en: 'New password (min. 6 characters)', fr: 'Nouveau mot de passe (6 caractères min.)', es: 'Nueva contraseña (mín. 6 caracteres)' },
  'settings.confirm_password': { pt: 'Confirmar nova palavra-passe', en: 'Confirm new password', fr: 'Confirmer le nouveau mot de passe', es: 'Confirmar nueva contraseña' },
  'settings.update_password': { pt: 'Atualizar palavra-passe', en: 'Update password', fr: 'Mettre à jour', es: 'Actualizar contraseña' },
} as const;

type TranslationKey = keyof typeof translations;
type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void; t: (key: TranslationKey) => string };

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'kaya_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('pt');

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then(value => {
      if (value === 'pt' || value === 'en' || value === 'fr' || value === 'es') setLanguageState(value);
    }).catch(() => {});
  }, []);

  const setLanguage = (next: AppLanguage) => {
    setLanguageState(next);
    void SecureStore.setItemAsync(STORAGE_KEY, next);
  };
  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key: TranslationKey) => translations[key]?.[language] || translations[key]?.pt || key,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used within LanguageProvider');
  return value;
}
