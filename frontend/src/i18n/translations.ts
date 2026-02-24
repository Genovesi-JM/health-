/**
 * Translation keys for Health Platform — PT / EN / FR.
 *
 * Convention: keys are flat, dot-separated for readability.
 * Use t('section.key') to retrieve the translation for the active language.
 */

export type Lang = 'pt' | 'en' | 'fr';

export const LANG_LABELS: Record<Lang, string> = { pt: 'Português', en: 'English', fr: 'Français' };
export const LANG_FLAGS: Record<Lang, string> = { pt: '🇵🇹', en: '🇬🇧', fr: '🇫🇷' };

const translations: Record<string, Record<Lang, string>> = {
  /* ═══════════════════════════════════════════════════════════
     NAVBAR & FOOTER (public)
     ═══════════════════════════════════════════════════════════ */
  'nav.home': { pt: 'Início', en: 'Home', fr: 'Accueil' },
  'nav.about': { pt: 'Sobre', en: 'About', fr: 'À propos' },
  'nav.services': { pt: 'Serviços', en: 'Services', fr: 'Services' },
  'nav.portal': { pt: 'Portal', en: 'Portal', fr: 'Portail' },

  'footer.brand_desc': {
    pt: 'Plataforma digital de triagem inteligente e teleconsulta médica. Conectamos pacientes a profissionais de saúde de forma segura e eficiente.',
    en: 'Digital platform for intelligent triage and medical teleconsultation. We connect patients to healthcare professionals securely and efficiently.',
    fr: 'Plateforme numérique de triage intelligent et de téléconsultation médicale. Nous connectons les patients aux professionnels de santé de manière sécurisée et efficace.',
  },
  'footer.platform': { pt: 'Plataforma', en: 'Platform', fr: 'Plateforme' },
  'footer.about_us': { pt: 'Sobre Nós', en: 'About Us', fr: 'À propos' },
  'footer.services': { pt: 'Serviços', en: 'Services', fr: 'Services' },
  'footer.services_list.triage': { pt: 'Triagem Inteligente', en: 'Intelligent Triage', fr: 'Triage Intelligent' },
  'footer.services_list.teleconsult': { pt: 'Teleconsulta', en: 'Teleconsultation', fr: 'Téléconsultation' },
  'footer.services_list.prescriptions': { pt: 'Prescrições Digitais', en: 'Digital Prescriptions', fr: 'Prescriptions Numériques' },
  'footer.services_list.management': { pt: 'Gestão Clínica', en: 'Clinical Management', fr: 'Gestion Clinique' },
  'footer.contact': { pt: 'Contacto', en: 'Contact', fr: 'Contact' },
  'footer.rights': { pt: 'Todos os direitos reservados.', en: 'All rights reserved.', fr: 'Tous droits réservés.' },
  'footer.privacy': { pt: 'Privacidade', en: 'Privacy', fr: 'Confidentialité' },
  'footer.terms': { pt: 'Termos', en: 'Terms', fr: 'Conditions' },

  /* ═══════════════════════════════════════════════════════════
     LANDING PAGE
     ═══════════════════════════════════════════════════════════ */
  'landing.badge': { pt: 'Plataforma Digital de Saúde', en: 'Digital Health Platform', fr: 'Plateforme de Santé Numérique' },
  'landing.hero_title1': { pt: 'Saúde Digital', en: 'Digital Health', fr: 'Santé Numérique' },
  'landing.hero_title2': { pt: 'Triagem & Teleconsulta', en: 'Triage & Teleconsultation', fr: 'Triage & Téléconsultation' },
  'landing.hero_desc': {
    pt: 'Plataforma inteligente de triagem médica e teleconsulta. Avalie sintomas, receba recomendações clínicas e conecte-se com médicos — tudo num único portal.',
    en: 'Intelligent medical triage and teleconsultation platform. Evaluate symptoms, receive clinical recommendations and connect with doctors — all in one portal.',
    fr: 'Plateforme intelligente de triage médical et de téléconsultation. Évaluez vos symptômes, recevez des recommandations cliniques et connectez-vous avec des médecins — le tout sur un seul portail.',
  },
  'landing.start_now': { pt: 'Começar Agora', en: 'Get Started', fr: 'Commencer' },
  'landing.learn_more': { pt: 'Saber Mais', en: 'Learn More', fr: 'En savoir plus' },
  'landing.stat_patients': { pt: 'Pacientes', en: 'Patients', fr: 'Patients' },
  'landing.stat_doctors': { pt: 'Médicos', en: 'Doctors', fr: 'Médecins' },
  'landing.stat_satisfaction': { pt: 'Satisfação', en: 'Satisfaction', fr: 'Satisfaction' },
  'landing.stat_available': { pt: 'Disponível', en: 'Available', fr: 'Disponible' },
  'landing.services_title': { pt: 'Os Nossos Serviços', en: 'Our Services', fr: 'Nos Services' },
  'landing.services_subtitle': { pt: 'Soluções digitais completas para o seu percurso de saúde', en: 'Complete digital solutions for your health journey', fr: 'Solutions numériques complètes pour votre parcours de santé' },
  'landing.svc.triage': { pt: 'Triagem Inteligente', en: 'Intelligent Triage', fr: 'Triage Intelligent' },
  'landing.svc.triage_desc': {
    pt: 'Sistema de avaliação baseado em sintomas com classificação de risco automática e recomendação de ação clínica.',
    en: 'Symptom-based assessment system with automatic risk classification and clinical action recommendations.',
    fr: 'Système d\'évaluation basé sur les symptômes avec classification automatique des risques et recommandations d\'actions cliniques.',
  },
  'landing.svc.teleconsult': { pt: 'Teleconsulta Médica', en: 'Medical Teleconsultation', fr: 'Téléconsultation Médicale' },
  'landing.svc.teleconsult_desc': {
    pt: 'Consultas online com médicos verificados, agendamento flexível e histórico clínico integrado.',
    en: 'Online consultations with verified doctors, flexible scheduling and integrated clinical history.',
    fr: 'Consultations en ligne avec des médecins vérifiés, planification flexible et historique clinique intégré.',
  },
  'landing.svc.prescriptions': { pt: 'Prescrições Digitais', en: 'Digital Prescriptions', fr: 'Prescriptions Numériques' },
  'landing.svc.prescriptions_desc': {
    pt: 'Receitas médicas digitais seguras, com validação e acompanhamento de tratamento.',
    en: 'Secure digital medical prescriptions with validation and treatment follow-up.',
    fr: 'Prescriptions médicales numériques sécurisées avec validation et suivi du traitement.',
  },
  'landing.svc.followup': { pt: 'Acompanhamento Contínuo', en: 'Continuous Follow-up', fr: 'Suivi Continu' },
  'landing.svc.followup_desc': {
    pt: 'Monitorização do estado de saúde, lembretes de medicação e acompanhamento pós-consulta.',
    en: 'Health status monitoring, medication reminders and post-consultation follow-up.',
    fr: 'Surveillance de l\'état de santé, rappels de médicaments et suivi post-consultation.',
  },
  'landing.svc.corporate': { pt: 'Gestão Corporativa', en: 'Corporate Management', fr: 'Gestion d\'Entreprise' },
  'landing.svc.corporate_desc': {
    pt: 'Soluções para empresas e organizações com painel de saúde ocupacional e relatórios.',
    en: 'Solutions for companies and organizations with occupational health dashboard and reports.',
    fr: 'Solutions pour entreprises et organisations avec tableau de bord de santé au travail et rapports.',
  },
  'landing.svc.emergency': { pt: 'Urgência & Emergência', en: 'Urgency & Emergency', fr: 'Urgence & Émergence' },
  'landing.svc.emergency_desc': {
    pt: 'Identificação rápida de casos urgentes com encaminhamento prioritário para serviços de emergência.',
    en: 'Rapid identification of urgent cases with priority referral to emergency services.',
    fr: 'Identification rapide des cas urgents avec orientation prioritaire vers les services d\'urgence.',
  },
  'landing.features_title': { pt: 'Porque Escolher-nos', en: 'Why Choose Us', fr: 'Pourquoi Nous Choisir' },
  'landing.features_subtitle': { pt: 'Tecnologia avançada ao serviço da sua saúde', en: 'Advanced technology at the service of your health', fr: 'Technologie avancée au service de votre santé' },
  'landing.feat.immediate': { pt: 'Resposta Imediata', en: 'Immediate Response', fr: 'Réponse Immédiate' },
  'landing.feat.immediate_desc': {
    pt: 'Triagem em menos de 3 minutos com recomendações baseadas em protocolos clínicos.',
    en: 'Triage in less than 3 minutes with recommendations based on clinical protocols.',
    fr: 'Triage en moins de 3 minutes avec des recommandations basées sur des protocoles cliniques.',
  },
  'landing.feat.secure': { pt: 'Dados Seguros', en: 'Secure Data', fr: 'Données Sécurisées' },
  'landing.feat.secure_desc': {
    pt: 'Encriptação ponta-a-ponta, conformidade com LGPD e controlo total dos seus dados de saúde.',
    en: 'End-to-end encryption, LGPD compliance and full control over your health data.',
    fr: 'Chiffrement de bout en bout, conformité LGPD et contrôle total de vos données de santé.',
  },
  'landing.feat.analytics': { pt: 'Analytics Clínico', en: 'Clinical Analytics', fr: 'Analytique Clinique' },
  'landing.feat.analytics_desc': {
    pt: 'Dashboards com KPIs de saúde, tendências e relatórios para gestão clínica.',
    en: 'Dashboards with health KPIs, trends and reports for clinical management.',
    fr: 'Tableaux de bord avec KPIs de santé, tendances et rapports pour la gestion clinique.',
  },
  'landing.feat.universal': { pt: 'Acesso Universal', en: 'Universal Access', fr: 'Accès Universel' },
  'landing.feat.universal_desc': {
    pt: 'Plataforma responsiva acessível de qualquer dispositivo, a qualquer hora.',
    en: 'Responsive platform accessible from any device, at any time.',
    fr: 'Plateforme responsive accessible depuis n\'importe quel appareil, à tout moment.',
  },
  'landing.feat.coverage': { pt: 'Cobertura Nacional', en: 'National Coverage', fr: 'Couverture Nationale' },
  'landing.feat.coverage_desc': {
    pt: 'Rede de médicos verificados em todo o território, disponíveis para teleconsulta.',
    en: 'Network of verified doctors across the territory, available for teleconsultation.',
    fr: 'Réseau de médecins vérifiés sur tout le territoire, disponibles pour la téléconsultation.',
  },
  'landing.feat.humanized': { pt: 'Cuidado Humanizado', en: 'Humanized Care', fr: 'Soins Humanisés' },
  'landing.feat.humanized_desc': {
    pt: 'Tecnologia ao serviço da saúde, mantendo o foco no paciente e na qualidade de vida.',
    en: 'Technology at the service of health, keeping the focus on the patient and quality of life.',
    fr: 'La technologie au service de la santé, en gardant le focus sur le patient et la qualité de vie.',
  },
  'landing.cta_title': { pt: 'Pronto para cuidar da sua saúde?', en: 'Ready to take care of your health?', fr: 'Prêt à prendre soin de votre santé ?' },
  'landing.cta_desc': { pt: 'Registe-se gratuitamente e comece a sua triagem em menos de 3 minutos.', en: 'Register for free and start your triage in less than 3 minutes.', fr: 'Inscrivez-vous gratuitement et commencez votre triage en moins de 3 minutes.' },
  'landing.create_free': { pt: 'Criar Conta Grátis', en: 'Create Free Account', fr: 'Créer un Compte Gratuit' },
  'landing.have_account': { pt: 'Já tenho conta', en: 'I have an account', fr: 'J\'ai un compte' },

  /* ═══════════════════════════════════════════════════════════
     ABOUT PAGE
     ═══════════════════════════════════════════════════════════ */
  'about.badge': { pt: 'Sobre a Health Platform', en: 'About Health Platform', fr: 'À propos de Health Platform' },
  'about.hero_title1': { pt: 'Transformar a Saúde', en: 'Transform Healthcare', fr: 'Transformer la Santé' },
  'about.hero_title2': { pt: 'com Tecnologia', en: 'with Technology', fr: 'avec la Technologie' },
  'about.hero_desc': {
    pt: 'Somos uma plataforma digital de saúde que combina inteligência artificial, teleconsulta médica e gestão clínica para democratizar o acesso a cuidados de saúde de qualidade.',
    en: 'We are a digital health platform that combines artificial intelligence, medical teleconsultation and clinical management to democratize access to quality healthcare.',
    fr: 'Nous sommes une plateforme de santé numérique qui combine intelligence artificielle, téléconsultation médicale et gestion clinique pour démocratiser l\'accès aux soins de santé de qualité.',
  },
  'about.mission': { pt: 'Missão', en: 'Mission', fr: 'Mission' },
  'about.mission_desc': {
    pt: 'Democratizar o acesso à saúde através de uma plataforma inteligente de triagem e teleconsulta, conectando pacientes a profissionais de saúde qualificados de forma segura, eficiente e acessível.',
    en: 'Democratize access to healthcare through an intelligent triage and teleconsultation platform, connecting patients to qualified healthcare professionals securely, efficiently and affordably.',
    fr: 'Démocratiser l\'accès aux soins de santé grâce à une plateforme intelligente de triage et de téléconsultation, connectant les patients à des professionnels de santé qualifiés de manière sécurisée, efficace et accessible.',
  },
  'about.vision': { pt: 'Visão', en: 'Vision', fr: 'Vision' },
  'about.vision_desc': {
    pt: 'Ser a referência em saúde digital em África, liderando a transformação do acesso a cuidados de saúde com tecnologia de ponta e um compromisso inabalável com o bem-estar do paciente.',
    en: 'To be the reference in digital health in Africa, leading the transformation of healthcare access with cutting-edge technology and an unwavering commitment to patient well-being.',
    fr: 'Être la référence en santé numérique en Afrique, en menant la transformation de l\'accès aux soins de santé avec une technologie de pointe et un engagement indéfectible envers le bien-être des patients.',
  },
  'about.values_title': { pt: 'Os Nossos Valores', en: 'Our Values', fr: 'Nos Valeurs' },
  'about.values_subtitle': { pt: 'Princípios que orientam tudo o que fazemos', en: 'Principles that guide everything we do', fr: 'Principes qui guident tout ce que nous faisons' },
  'about.val.patient_care': { pt: 'Cuidado ao Paciente', en: 'Patient Care', fr: 'Soins aux Patients' },
  'about.val.patient_care_desc': {
    pt: 'Colocamos o paciente no centro de cada decisão, garantindo uma experiência acessível e humanizada.',
    en: 'We place the patient at the center of every decision, ensuring an accessible and humanized experience.',
    fr: 'Nous plaçons le patient au centre de chaque décision, garantissant une expérience accessible et humanisée.',
  },
  'about.val.security': { pt: 'Segurança & Privacidade', en: 'Security & Privacy', fr: 'Sécurité & Confidentialité' },
  'about.val.security_desc': {
    pt: 'Protecção rigorosa dos dados clínicos com encriptação e conformidade regulamentar.',
    en: 'Rigorous protection of clinical data with encryption and regulatory compliance.',
    fr: 'Protection rigoureuse des données cliniques avec chiffrement et conformité réglementaire.',
  },
  'about.val.inclusion': { pt: 'Inclusão Digital', en: 'Digital Inclusion', fr: 'Inclusion Numérique' },
  'about.val.inclusion_desc': {
    pt: 'Plataforma acessível a todos, independentemente da localização geográfica ou nível tecnológico.',
    en: 'Platform accessible to everyone, regardless of geographic location or technological level.',
    fr: 'Plateforme accessible à tous, indépendamment de la localisation géographique ou du niveau technologique.',
  },
  'about.val.excellence': { pt: 'Excelência Clínica', en: 'Clinical Excellence', fr: 'Excellence Clinique' },
  'about.val.excellence_desc': {
    pt: 'Médicos verificados, protocolos baseados em evidência e melhoria contínua de qualidade.',
    en: 'Verified doctors, evidence-based protocols and continuous quality improvement.',
    fr: 'Médecins vérifiés, protocoles fondés sur des preuves et amélioration continue de la qualité.',
  },
  'about.val.innovation': { pt: 'Inovação Contínua', en: 'Continuous Innovation', fr: 'Innovation Continue' },
  'about.val.innovation_desc': {
    pt: 'Investimos em IA e machine learning para triagens cada vez mais precisas e eficientes.',
    en: 'We invest in AI and machine learning for increasingly precise and efficient triage.',
    fr: 'Nous investissons dans l\'IA et le machine learning pour un triage de plus en plus précis et efficace.',
  },
  'about.val.transparency': { pt: 'Transparência', en: 'Transparency', fr: 'Transparence' },
  'about.val.transparency_desc': {
    pt: 'Comunicação clara sobre custos, processos e resultados em todas as etapas do serviço.',
    en: 'Clear communication about costs, processes and results at every stage of the service.',
    fr: 'Communication claire sur les coûts, les processus et les résultats à chaque étape du service.',
  },
  'about.cta_title': { pt: 'Junte-se a nós', en: 'Join Us', fr: 'Rejoignez-nous' },
  'about.cta_desc': { pt: 'Faça parte da revolução digital em saúde. Registe-se e comece hoje.', en: 'Be part of the digital health revolution. Register and start today.', fr: 'Faites partie de la révolution numérique de la santé. Inscrivez-vous et commencez aujourd\'hui.' },
  'about.create_account': { pt: 'Criar Conta', en: 'Create Account', fr: 'Créer un Compte' },

  /* ═══════════════════════════════════════════════════════════
     LOGIN PAGE
     ═══════════════════════════════════════════════════════════ */
  'login.title': { pt: 'Iniciar Sessão', en: 'Sign In', fr: 'Connexion' },
  'login.subtitle': { pt: 'Aceda ao portal Health Platform', en: 'Access the Health Platform portal', fr: 'Accédez au portail Health Platform' },
  'login.email': { pt: 'Email', en: 'Email', fr: 'Email' },
  'login.password': { pt: 'Palavra-passe', en: 'Password', fr: 'Mot de passe' },
  'login.submit': { pt: 'Iniciar Sessão', en: 'Sign In', fr: 'Se connecter' },
  'login.loading': { pt: 'A entrar…', en: 'Signing in…', fr: 'Connexion…' },
  'login.google': { pt: 'Entrar com Google', en: 'Sign in with Google', fr: 'Se connecter avec Google' },
  'login.microsoft': { pt: 'Entrar com Microsoft', en: 'Sign in with Microsoft', fr: 'Se connecter avec Microsoft' },
  'login.forgot': { pt: 'Esqueceu a palavra-passe?', en: 'Forgot password?', fr: 'Mot de passe oublié ?' },
  'login.no_account': { pt: 'Não tem conta?', en: "Don't have an account?", fr: "Vous n'avez pas de compte ?" },
  'login.create_account': { pt: 'Criar conta', en: 'Create account', fr: 'Créer un compte' },
  'login.invalid': { pt: 'Credenciais inválidas.', en: 'Invalid credentials.', fr: 'Identifiants invalides.' },
  'login.access_hint': { pt: 'Aceda com as suas credenciais.', en: 'Access with your credentials.', fr: 'Accédez avec vos identifiants.' },
  'login.back_site': { pt: '← Voltar ao site', en: '← Back to site', fr: '← Retour au site' },
  'login.forgot_title': { pt: 'Recuperar Palavra-passe', en: 'Recover Password', fr: 'Récupérer le mot de passe' },
  'login.forgot_desc': { pt: 'Insira o seu email e enviaremos instruções de recuperação.', en: 'Enter your email and we will send recovery instructions.', fr: 'Entrez votre email et nous vous enverrons des instructions de récupération.' },
  'login.forgot_submit': { pt: 'Enviar', en: 'Send', fr: 'Envoyer' },
  'login.forgot_msg': { pt: 'Se o email existir, receberá instruções de recuperação.', en: 'If the email exists, you will receive recovery instructions.', fr: 'Si l\'email existe, vous recevrez des instructions de récupération.' },

  /* ═══════════════════════════════════════════════════════════
     REGISTER PAGE
     ═══════════════════════════════════════════════════════════ */
  'register.title': { pt: 'Criar Conta', en: 'Create Account', fr: 'Créer un Compte' },
  'register.subtitle': { pt: 'Registe-se na Health Platform', en: 'Register on Health Platform', fr: 'Inscrivez-vous sur Health Platform' },
  'register.full_name': { pt: 'Nome Completo', en: 'Full Name', fr: 'Nom Complet' },
  'register.email': { pt: 'Email', en: 'Email', fr: 'Email' },
  'register.password': { pt: 'Palavra-passe', en: 'Password', fr: 'Mot de passe' },
  'register.password_placeholder': { pt: 'Escolha uma palavra-passe', en: 'Choose a password', fr: 'Choisissez un mot de passe' },
  'register.confirm_password': { pt: 'Confirmar Palavra-passe', en: 'Confirm Password', fr: 'Confirmer le mot de passe' },
  'register.confirm_placeholder': { pt: 'Repetir palavra-passe', en: 'Repeat password', fr: 'Répéter le mot de passe' },
  'register.sector': { pt: 'Área de Interesse', en: 'Area of Interest', fr: 'Domaine d\'Intérêt' },
  'register.sector_select': { pt: 'Selecionar especialidade', en: 'Select specialty', fr: 'Sélectionner la spécialité' },
  'register.sector_general': { pt: 'Clínica Geral', en: 'General Practice', fr: 'Médecine Générale' },
  'register.sector_cardiology': { pt: 'Cardiologia', en: 'Cardiology', fr: 'Cardiologie' },
  'register.sector_dermatology': { pt: 'Dermatologia', en: 'Dermatology', fr: 'Dermatologie' },
  'register.sector_pediatrics': { pt: 'Pediatria', en: 'Pediatrics', fr: 'Pédiatrie' },
  'register.sector_orthopedics': { pt: 'Ortopedia', en: 'Orthopedics', fr: 'Orthopédie' },
  'register.sector_neurology': { pt: 'Neurologia', en: 'Neurology', fr: 'Neurologie' },
  'register.submit': { pt: 'Criar Conta', en: 'Create Account', fr: 'Créer un Compte' },
  'register.loading': { pt: 'A criar…', en: 'Creating…', fr: 'Création…' },
  'register.cancel': { pt: 'Cancelar', en: 'Cancel', fr: 'Annuler' },
  'register.pw_mismatch': { pt: 'As palavras-passe não coincidem.', en: 'Passwords do not match.', fr: 'Les mots de passe ne correspondent pas.' },
  'register.pw_short': { pt: 'A palavra-passe deve ter pelo menos 6 caracteres.', en: 'Password must be at least 6 characters.', fr: 'Le mot de passe doit contenir au moins 6 caractères.' },
  'register.error': { pt: 'Erro ao criar conta.', en: 'Error creating account.', fr: 'Erreur lors de la création du compte.' },
  'register.have_account': { pt: 'Já tem conta?', en: 'Already have an account?', fr: 'Vous avez déjà un compte ?' },
  'register.sign_in': { pt: 'Iniciar sessão', en: 'Sign in', fr: 'Se connecter' },
  'register.back_site': { pt: '← Voltar ao site', en: '← Back to site', fr: '← Retour au site' },

  /* ═══════════════════════════════════════════════════════════
     SIDEBAR
     ═══════════════════════════════════════════════════════════ */
  'sidebar.main': { pt: 'Principal', en: 'Main', fr: 'Principal' },
  'sidebar.overview': { pt: 'Visão Geral', en: 'Overview', fr: 'Aperçu' },
  'sidebar.my_profile': { pt: 'Meu Perfil', en: 'My Profile', fr: 'Mon Profil' },
  'sidebar.triage': { pt: 'Triagem', en: 'Triage', fr: 'Triage' },
  'sidebar.consultations': { pt: 'Consultas', en: 'Consultations', fr: 'Consultations' },
  'sidebar.consents': { pt: 'Consentimentos', en: 'Consents', fr: 'Consentements' },
  'sidebar.self_care': { pt: 'Autocuidado', en: 'Self-Care', fr: 'Auto-soins' },
  'sidebar.doctor': { pt: 'Médico', en: 'Doctor', fr: 'Médecin' },
  'sidebar.doctor_profile': { pt: 'Perfil Médico', en: 'Doctor Profile', fr: 'Profil Médecin' },
  'sidebar.queue': { pt: 'Fila de Espera', en: 'Queue', fr: 'File d\'Attente' },
  'sidebar.admin': { pt: 'Administração', en: 'Administration', fr: 'Administration' },
  'sidebar.dashboard': { pt: 'Dashboard', en: 'Dashboard', fr: 'Tableau de Bord' },
  'sidebar.patients': { pt: 'Pacientes', en: 'Patients', fr: 'Patients' },
  'sidebar.verify_doctors': { pt: 'Verificar Médicos', en: 'Verify Doctors', fr: 'Vérifier Médecins' },
  'sidebar.account': { pt: 'Conta', en: 'Account', fr: 'Compte' },
  'sidebar.settings': { pt: 'Definições', en: 'Settings', fr: 'Paramètres' },
  'sidebar.logout': { pt: 'Terminar Sessão', en: 'Sign Out', fr: 'Déconnexion' },
  'sidebar.role_admin': { pt: 'Administrador', en: 'Administrator', fr: 'Administrateur' },
  'sidebar.role_doctor': { pt: 'Médico', en: 'Doctor', fr: 'Médecin' },
  'sidebar.role_patient': { pt: 'Paciente', en: 'Patient', fr: 'Patient' },
  'sidebar.user_fallback': { pt: 'Utilizador', en: 'User', fr: 'Utilisateur' },

  /* ═══════════════════════════════════════════════════════════
     TOPBAR (ProtectedRoute breadcrumbs)
     ═══════════════════════════════════════════════════════════ */
  'topbar.overview': { pt: 'Visão Geral', en: 'Overview', fr: 'Aperçu' },
  'topbar.my_profile': { pt: 'Meu Perfil', en: 'My Profile', fr: 'Mon Profil' },
  'topbar.triage': { pt: 'Triagem', en: 'Triage', fr: 'Triage' },
  'topbar.consultations': { pt: 'Consultas', en: 'Consultations', fr: 'Consultations' },
  'topbar.self_care': { pt: 'Autocuidado', en: 'Self-Care', fr: 'Auto-soins' },
  'topbar.consents': { pt: 'Consentimentos', en: 'Consents', fr: 'Consentements' },
  'topbar.doctor_profile': { pt: 'Perfil Médico', en: 'Doctor Profile', fr: 'Profil Médecin' },
  'topbar.queue': { pt: 'Fila de Espera', en: 'Queue', fr: 'File d\'Attente' },
  'topbar.admin_dashboard': { pt: 'Dashboard Admin', en: 'Admin Dashboard', fr: 'Tableau de Bord Admin' },
  'topbar.verify_doctors': { pt: 'Verificar Médicos', en: 'Verify Doctors', fr: 'Vérifier Médecins' },
  'topbar.settings': { pt: 'Definições', en: 'Settings', fr: 'Paramètres' },

  /* ═══════════════════════════════════════════════════════════
     DASHBOARD PAGE
     ═══════════════════════════════════════════════════════════ */
  'dash.panel': { pt: 'Painel do Paciente', en: 'Patient Panel', fr: 'Panneau du Patient' },
  'dash.hello': { pt: 'Olá,', en: 'Hello,', fr: 'Bonjour,' },
  'dash.subtitle': { pt: 'O seu assistente de saúde digital. Avalie sintomas, receba recomendações e marque consultas.', en: 'Your digital health assistant. Evaluate symptoms, receive recommendations and schedule consultations.', fr: 'Votre assistant de santé numérique. Évaluez les symptômes, recevez des recommandations et prenez rendez-vous.' },
  'dash.urgent_title': { pt: '⚠️ Atenção Urgente', en: '⚠️ Urgent Attention', fr: '⚠️ Attention Urgente' },
  'dash.urgent_desc': {
    pt: 'Com base na sua triagem, recomendamos que procure atendimento de urgência imediatamente. Ligue 112 ou dirija-se ao serviço de urgência mais próximo.',
    en: 'Based on your triage, we recommend you seek emergency care immediately. Call 112 or go to the nearest emergency room.',
    fr: 'Selon votre triage, nous recommandons de chercher des soins d\'urgence immédiatement. Appelez le 112 ou rendez-vous aux urgences les plus proches.',
  },
  'dash.current_state': { pt: 'Estado Atual', en: 'Current State', fr: 'État Actuel' },
  'dash.no_triage_desc': { pt: 'Inicie uma triagem inteligente para avaliar os seus sintomas e receber uma recomendação personalizada.', en: 'Start an intelligent triage to evaluate your symptoms and receive a personalized recommendation.', fr: 'Commencez un triage intelligent pour évaluer vos symptômes et recevoir une recommandation personnalisée.' },
  'dash.triage_in_progress': { pt: 'Complete a sua triagem para receber a classificação de risco.', en: 'Complete your triage to receive the risk classification.', fr: 'Complétez votre triage pour recevoir la classification des risques.' },
  'dash.complaint': { pt: 'Queixa:', en: 'Complaint:', fr: 'Plainte :' },
  'dash.risk': { pt: 'Risco', en: 'Risk', fr: 'Risque' },
  'dash.consultation_booked': { pt: 'A sua consulta está agendada. Aguarde o contacto do médico.', en: 'Your consultation is scheduled. Wait for the doctor\'s contact.', fr: 'Votre consultation est programmée. Attendez le contact du médecin.' },
  'dash.consultation_completed': { pt: 'Caso resolvido. Pode iniciar uma nova triagem se tiver novos sintomas.', en: 'Case resolved. You can start a new triage if you have new symptoms.', fr: 'Cas résolu. Vous pouvez commencer un nouveau triage si vous avez de nouveaux symptômes.' },
  'dash.last_risk': { pt: 'Último Risco', en: 'Last Risk', fr: 'Dernier Risque' },
  'dash.next_action': { pt: 'Próxima Ação', en: 'Next Action', fr: 'Prochaine Action' },
  'dash.whenever': { pt: 'Quando quiser', en: 'Whenever you want', fr: 'Quand vous voulez' },
  'dash.start_triage': { pt: 'Iniciar triagem', en: 'Start triage', fr: 'Commencer le triage' },
  'dash.history': { pt: 'Histórico', en: 'History', fr: 'Historique' },
  'dash.triages': { pt: 'triagens', en: 'triages', fr: 'triages' },
  'dash.triage_singular': { pt: 'triagem', en: 'triage', fr: 'triage' },
  'dash.consultations_done': { pt: 'consultas concluídas', en: 'consultations completed', fr: 'consultations terminées' },
  'dash.consultation_done': { pt: 'consulta concluída', en: 'consultation completed', fr: 'consultation terminée' },
  'dash.resolved': { pt: 'resolvido', en: 'resolved', fr: 'résolu' },
  'dash.btn_start_triage': { pt: 'Iniciar Triagem', en: 'Start Triage', fr: 'Commencer le Triage' },
  'dash.btn_consultations': { pt: 'Ver Consultas', en: 'View Consultations', fr: 'Voir les Consultations' },
  'dash.btn_profile': { pt: 'Meu Perfil', en: 'My Profile', fr: 'Mon Profil' },
  'dash.recent_triages': { pt: 'Triagens Recentes', en: 'Recent Triages', fr: 'Triages Récents' },
  'dash.view_all': { pt: 'Ver Todas', en: 'View All', fr: 'Voir Tout' },
  'dash.no_triages': { pt: 'Sem triagens', en: 'No triages', fr: 'Aucun triage' },
  'dash.no_triages_desc': { pt: 'Inicie a sua primeira triagem para avaliar os seus sintomas.', en: 'Start your first triage to evaluate your symptoms.', fr: 'Commencez votre premier triage pour évaluer vos symptômes.' },
  'dash.consultations': { pt: 'Consultas', en: 'Consultations', fr: 'Consultations' },
  'dash.manage': { pt: 'Gerir', en: 'Manage', fr: 'Gérer' },
  'dash.no_consultations': { pt: 'Sem consultas', en: 'No consultations', fr: 'Aucune consultation' },
  'dash.triage_done_book': { pt: 'Triagem concluída — marque uma consulta para ser atendido.', en: 'Triage completed — book a consultation to be seen.', fr: 'Triage terminé — prenez rendez-vous pour être vu.' },
  'dash.complete_triage_first': { pt: 'Complete uma triagem para desbloquear o agendamento.', en: 'Complete a triage to unlock scheduling.', fr: 'Complétez un triage pour débloquer la planification.' },
  'dash.book_consultation': { pt: 'Marcar Consulta', en: 'Book Consultation', fr: 'Prendre Rendez-vous' },
  'dash.keep_profile': { pt: 'Mantenha o perfil atualizado', en: 'Keep your profile updated', fr: 'Gardez votre profil à jour' },
  'dash.profile_tip': {
    pt: 'Alergias, condições crónicas e contacto de emergência melhoram a triagem.',
    en: 'Allergies, chronic conditions and emergency contact improve triage.',
    fr: 'Allergies, conditions chroniques et contact d\'urgence améliorent le triage.',
  },
  'dash.update_profile': { pt: 'Atualizar perfil', en: 'Update profile', fr: 'Mettre à jour le profil' },
  // Risk labels
  'risk.urgent': { pt: 'Urgente', en: 'Urgent', fr: 'Urgent' },
  'risk.high': { pt: 'Alto', en: 'High', fr: 'Élevé' },
  'risk.medium': { pt: 'Médio', en: 'Medium', fr: 'Moyen' },
  'risk.low': { pt: 'Baixo', en: 'Low', fr: 'Faible' },
  // Action labels
  'action.er_now': { pt: 'Procure atendimento de urgência imediatamente', en: 'Seek emergency care immediately', fr: 'Cherchez des soins d\'urgence immédiatement' },
  'action.doctor_now': { pt: 'Consulte um médico hoje', en: 'See a doctor today', fr: 'Consultez un médecin aujourd\'hui' },
  'action.doctor_24h': { pt: 'Consulta recomendada nas próximas 24h', en: 'Consultation recommended within the next 24h', fr: 'Consultation recommandée dans les prochaines 24h' },
  'action.self_care': { pt: 'Autocuidado com monitorização', en: 'Self-care with monitoring', fr: 'Auto-soins avec surveillance' },

  /* Table headers */
  'table.complaint': { pt: 'Queixa', en: 'Complaint', fr: 'Plainte' },
  'table.risk': { pt: 'Risco', en: 'Risk', fr: 'Risque' },
  'table.date': { pt: 'Data', en: 'Date', fr: 'Date' },
  'table.specialty': { pt: 'Especialidade', en: 'Specialty', fr: 'Spécialité' },
  'table.status': { pt: 'Estado', en: 'Status', fr: 'Statut' },
  'table.recommendation': { pt: 'Recomendação', en: 'Recommendation', fr: 'Recommandation' },
  'table.score': { pt: 'Score', en: 'Score', fr: 'Score' },
  'table.scheduled': { pt: 'Agendada', en: 'Scheduled', fr: 'Planifiée' },
  'table.payment': { pt: 'Pagamento', en: 'Payment', fr: 'Paiement' },
  'table.created': { pt: 'Criada', en: 'Created', fr: 'Créée' },
  'table.patient': { pt: 'Paciente', en: 'Patient', fr: 'Patient' },
  'table.actions': { pt: 'Ações', en: 'Actions', fr: 'Actions' },

  /* ═══════════════════════════════════════════════════════════
     TRIAGE PAGE
     ═══════════════════════════════════════════════════════════ */
  'triage.title': { pt: 'Triagem Inteligente', en: 'Intelligent Triage', fr: 'Triage Intelligent' },
  'triage.subtitle': { pt: 'Avaliação de sintomas com classificação automática de risco', en: 'Symptom assessment with automatic risk classification', fr: 'Évaluation des symptômes avec classification automatique des risques' },
  'triage.history_tab': { pt: 'Histórico', en: 'History', fr: 'Historique' },
  'triage.new_tab': { pt: 'Nova Triagem', en: 'New Triage', fr: 'Nouveau Triage' },
  'triage.sessions': { pt: 'Sessões de Triagem', en: 'Triage Sessions', fr: 'Sessions de Triage' },
  'triage.new_btn': { pt: 'Nova Triagem', en: 'New Triage', fr: 'Nouveau Triage' },
  'triage.no_sessions': { pt: 'Sem triagens realizadas', en: 'No triages performed', fr: 'Aucun triage effectué' },
  'triage.no_sessions_desc': { pt: 'Inicie a sua primeira triagem para avaliar o seu estado de saúde.', en: 'Start your first triage to assess your health status.', fr: 'Commencez votre premier triage pour évaluer votre état de santé.' },
  'triage.describe': { pt: 'Descreva os seus sintomas', en: 'Describe your symptoms', fr: 'Décrivez vos symptômes' },
  'triage.chief_complaint': { pt: 'Queixa Principal', en: 'Chief Complaint', fr: 'Plainte Principale' },
  'triage.describe_placeholder': { pt: 'Descreva os sintomas que está a sentir...', en: 'Describe the symptoms you are experiencing...', fr: 'Décrivez les symptômes que vous ressentez...' },
  'triage.starting': { pt: 'A iniciar…', en: 'Starting…', fr: 'Démarrage…' },
  'triage.start_btn': { pt: 'Iniciar Triagem', en: 'Start Triage', fr: 'Commencer le Triage' },
  'triage.answer_questions': { pt: 'Responda às seguintes questões', en: 'Answer the following questions', fr: 'Répondez aux questions suivantes' },
  'triage.yes': { pt: 'Sim', en: 'Yes', fr: 'Oui' },
  'triage.no': { pt: 'Não', en: 'No', fr: 'Non' },
  'triage.submitting': { pt: 'A avaliar…', en: 'Evaluating…', fr: 'Évaluation…' },
  'triage.submit': { pt: 'Submeter Respostas', en: 'Submit Answers', fr: 'Soumettre les Réponses' },
  'triage.result_title': { pt: 'Resultado da Triagem', en: 'Triage Result', fr: 'Résultat du Triage' },
  'triage.risk_level': { pt: 'Nível de Risco', en: 'Risk Level', fr: 'Niveau de Risque' },
  'triage.action_recommended': { pt: 'Ação Recomendada', en: 'Recommended Action', fr: 'Action Recommandée' },
  'triage.new_again': { pt: 'Nova Triagem', en: 'New Triage', fr: 'Nouveau Triage' },
  'triage.go_consultations': { pt: 'Ver Consultas', en: 'View Consultations', fr: 'Voir les Consultations' },
  'triage.er_label': { pt: 'Dirija-se às Urgências imediatamente', en: 'Go to Emergency Room immediately', fr: 'Rendez-vous aux Urgences immédiatement' },
  'triage.doctor_now_label': { pt: 'Consulte um médico hoje', en: 'See a doctor today', fr: 'Consultez un médecin aujourd\'hui' },
  'triage.doctor_24h_label': { pt: 'Agende consulta nas próximas 24h', en: 'Schedule consultation within 24h', fr: 'Planifiez une consultation dans les 24h' },
  'triage.self_care_label': { pt: 'Auto-cuidado com monitorização', en: 'Self-care with monitoring', fr: 'Auto-soins avec surveillance' },

  /* ═══════════════════════════════════════════════════════════
     CONSULTATIONS PAGE
     ═══════════════════════════════════════════════════════════ */
  'consult.title': { pt: 'Consultas', en: 'Consultations', fr: 'Consultations' },
  'consult.subtitle': { pt: 'Gerir e acompanhar as suas consultas médicas', en: 'Manage and track your medical consultations', fr: 'Gérer et suivre vos consultations médicales' },
  'consult.tab_all': { pt: 'Todas', en: 'All', fr: 'Toutes' },
  'consult.tab_upcoming': { pt: 'Próximas', en: 'Upcoming', fr: 'À venir' },
  'consult.tab_past': { pt: 'Passadas', en: 'Past', fr: 'Passées' },
  'consult.no_scheduled': { pt: 'Sem consultas agendadas', en: 'No scheduled consultations', fr: 'Aucune consultation planifiée' },
  'consult.no_past': { pt: 'Sem consultas passadas', en: 'No past consultations', fr: 'Aucune consultation passée' },
  'consult.no_any': { pt: 'Sem consultas', en: 'No consultations', fr: 'Aucune consultation' },
  'consult.self_care_msg': { pt: 'Autocuidado recomendado. Pode marcar consulta se desejar acompanhamento.', en: 'Self-care recommended. You may book a consultation for follow-up.', fr: 'Auto-soins recommandés. Vous pouvez prendre rendez-vous pour un suivi.' },
  'consult.medium_msg': { pt: 'Consulta recomendada nas próximas 24h com base na sua triagem.', en: 'Consultation recommended within 24h based on your triage.', fr: 'Consultation recommandée dans les 24h selon votre triage.' },
  'consult.urgent_msg': { pt: 'Consulta recomendada com urgência com base na sua classificação de risco.', en: 'Urgent consultation recommended based on your risk classification.', fr: 'Consultation urgente recommandée selon votre classification de risque.' },
  'consult.complete_first': { pt: 'Complete uma triagem para desbloquear o agendamento de consultas.', en: 'Complete a triage to unlock consultation scheduling.', fr: 'Complétez un triage pour débloquer la prise de rendez-vous.' },
  'consult.no_records': { pt: 'Não existem consultas registadas.', en: 'No consultations recorded.', fr: 'Aucune consultation enregistrée.' },
  'consult.book_now': { pt: 'Marcar Consulta Agora', en: 'Book Consultation Now', fr: 'Prendre Rendez-vous Maintenant' },
  'consult.complete_triage': { pt: 'Completar Triagem', en: 'Complete Triage', fr: 'Compléter le Triage' },
  'consult.recommended_by': { pt: 'Recomendado: até', en: 'Recommended: by', fr: 'Recommandé : avant' },
  'consult.status_requested': { pt: 'Pedido', en: 'Requested', fr: 'Demandé' },
  'consult.status_scheduled': { pt: 'Agendada', en: 'Scheduled', fr: 'Planifiée' },
  'consult.status_in_progress': { pt: 'Em Curso', en: 'In Progress', fr: 'En Cours' },
  'consult.status_completed': { pt: 'Concluída', en: 'Completed', fr: 'Terminée' },
  'consult.status_cancelled': { pt: 'Cancelada', en: 'Cancelled', fr: 'Annulée' },
  'consult.status_no_show': { pt: 'Falta', en: 'No Show', fr: 'Absent' },

  /* ═══════════════════════════════════════════════════════════
     PATIENT PROFILE PAGE
     ═══════════════════════════════════════════════════════════ */
  'profile.title': { pt: 'Perfil Clínico', en: 'Clinical Profile', fr: 'Profil Clinique' },
  'profile.subtitle': { pt: 'Gerir os seus dados de saúde e informações pessoais', en: 'Manage your health data and personal information', fr: 'Gérer vos données de santé et informations personnelles' },
  'profile.personal': { pt: 'Informações Pessoais', en: 'Personal Information', fr: 'Informations Personnelles' },
  'profile.dob': { pt: 'Data de Nascimento', en: 'Date of Birth', fr: 'Date de Naissance' },
  'profile.gender': { pt: 'Género', en: 'Gender', fr: 'Genre' },
  'profile.gender_select': { pt: 'Selecionar', en: 'Select', fr: 'Sélectionner' },
  'profile.gender_male': { pt: 'Masculino', en: 'Male', fr: 'Masculin' },
  'profile.gender_female': { pt: 'Feminino', en: 'Female', fr: 'Féminin' },
  'profile.gender_other': { pt: 'Outro', en: 'Other', fr: 'Autre' },
  'profile.blood_type': { pt: 'Tipo Sanguíneo', en: 'Blood Type', fr: 'Groupe Sanguin' },
  'profile.allergies': { pt: 'Alergias (separadas por vírgula)', en: 'Allergies (comma separated)', fr: 'Allergies (séparées par des virgules)' },
  'profile.allergies_placeholder': { pt: 'Ex: Penicilina, Glúten', en: 'E.g.: Penicillin, Gluten', fr: 'Ex : Pénicilline, Gluten' },
  'profile.chronic': { pt: 'Condições Crónicas (separadas por vírgula)', en: 'Chronic Conditions (comma separated)', fr: 'Conditions Chroniques (séparées par des virgules)' },
  'profile.chronic_placeholder': { pt: 'Ex: Diabetes, Hipertensão', en: 'E.g.: Diabetes, Hypertension', fr: 'Ex : Diabète, Hypertension' },
  'profile.emergency_name': { pt: 'Contacto de Emergência — Nome', en: 'Emergency Contact — Name', fr: 'Contact d\'Urgence — Nom' },
  'profile.emergency_name_placeholder': { pt: 'Nome do contacto', en: 'Contact name', fr: 'Nom du contact' },
  'profile.emergency_phone': { pt: 'Contacto de Emergência — Telefone', en: 'Emergency Contact — Phone', fr: 'Contact d\'Urgence — Téléphone' },
  'profile.save': { pt: 'Guardar Perfil', en: 'Save Profile', fr: 'Enregistrer le Profil' },
  'profile.saving': { pt: 'A guardar…', en: 'Saving…', fr: 'Enregistrement…' },
  'profile.saved': { pt: 'Perfil guardado com sucesso.', en: 'Profile saved successfully.', fr: 'Profil enregistré avec succès.' },
  'profile.save_error': { pt: 'Erro ao guardar.', en: 'Error saving.', fr: 'Erreur lors de l\'enregistrement.' },
  'profile.info_tip': {
    pt: 'Estas informações são utilizadas durante a triagem e consultas médicas. Quanto mais completo o perfil, melhor a qualidade do atendimento.',
    en: 'This information is used during triage and medical consultations. The more complete your profile, the better the quality of care.',
    fr: 'Ces informations sont utilisées lors du triage et des consultations médicales. Plus votre profil est complet, meilleure est la qualité des soins.',
  },

  /* ═══════════════════════════════════════════════════════════
     SETTINGS PAGE
     ═══════════════════════════════════════════════════════════ */
  'settings.title': { pt: 'Definições', en: 'Settings', fr: 'Paramètres' },
  'settings.subtitle': { pt: 'Gerir as configurações da sua conta', en: 'Manage your account settings', fr: 'Gérer les paramètres de votre compte' },
  'settings.tab_account': { pt: 'Conta', en: 'Account', fr: 'Compte' },
  'settings.tab_security': { pt: 'Segurança', en: 'Security', fr: 'Sécurité' },
  'settings.tab_notifications': { pt: 'Notificações', en: 'Notifications', fr: 'Notifications' },
  'settings.account_info': { pt: 'Informações da Conta', en: 'Account Information', fr: 'Informations du Compte' },
  'settings.email': { pt: 'Email', en: 'Email', fr: 'Email' },
  'settings.role': { pt: 'Função', en: 'Role', fr: 'Rôle' },
  'settings.name': { pt: 'Nome', en: 'Name', fr: 'Nom' },
  'settings.contact_support': { pt: 'Para alterar estas informações, contacte o suporte.', en: 'To change this information, contact support.', fr: 'Pour modifier ces informations, contactez le support.' },
  'settings.change_pw': { pt: 'Alterar Palavra-passe', en: 'Change Password', fr: 'Changer le Mot de Passe' },
  'settings.current_pw': { pt: 'Palavra-passe atual', en: 'Current password', fr: 'Mot de passe actuel' },
  'settings.new_pw': { pt: 'Nova palavra-passe', en: 'New password', fr: 'Nouveau mot de passe' },
  'settings.confirm_pw': { pt: 'Confirmar nova palavra-passe', en: 'Confirm new password', fr: 'Confirmer le nouveau mot de passe' },
  'settings.pw_submit': { pt: 'Alterar', en: 'Change', fr: 'Modifier' },
  'settings.pw_loading': { pt: 'A alterar…', en: 'Changing…', fr: 'Modification…' },
  'settings.pw_mismatch': { pt: 'As palavras-passe não coincidem.', en: 'Passwords do not match.', fr: 'Les mots de passe ne correspondent pas.' },
  'settings.pw_short': { pt: 'Mínimo 6 caracteres.', en: 'Minimum 6 characters.', fr: 'Minimum 6 caractères.' },
  'settings.pw_success': { pt: 'Palavra-passe alterada com sucesso.', en: 'Password changed successfully.', fr: 'Mot de passe modifié avec succès.' },
  'settings.pw_error': { pt: 'Erro ao alterar.', en: 'Error changing password.', fr: 'Erreur lors du changement de mot de passe.' },
  'settings.notif_title': { pt: 'Preferências de Notificação', en: 'Notification Preferences', fr: 'Préférences de Notification' },
  'settings.notif_triage': { pt: 'Alertas de Triagem', en: 'Triage Alerts', fr: 'Alertes de Triage' },
  'settings.notif_consult': { pt: 'Lembretes de Consulta', en: 'Consultation Reminders', fr: 'Rappels de Consultation' },
  'settings.notif_updates': { pt: 'Atualizações da Plataforma', en: 'Platform Updates', fr: 'Mises à jour de la Plateforme' },
  'settings.notif_promo': { pt: 'Emails Promocionais', en: 'Promotional Emails', fr: 'Emails Promotionnels' },

  /* ═══════════════════════════════════════════════════════════
     CONSENTS PAGE
     ═══════════════════════════════════════════════════════════ */
  'consents.title': { pt: 'Consentimentos', en: 'Consents', fr: 'Consentements' },
  'consents.subtitle': { pt: 'Gerir os seus consentimentos e autorizações de saúde', en: 'Manage your health consents and authorizations', fr: 'Gérer vos consentements et autorisations de santé' },
  'consents.new': { pt: 'Novo Consentimento', en: 'New Consent', fr: 'Nouveau Consentement' },
  'consents.type': { pt: 'Tipo de Consentimento', en: 'Consent Type', fr: 'Type de Consentement' },
  'consents.select': { pt: 'Selecionar', en: 'Select', fr: 'Sélectionner' },
  'consents.accept': { pt: 'Aceitar', en: 'Accept', fr: 'Accepter' },
  'consents.accepting': { pt: 'A registar…', en: 'Registering…', fr: 'Enregistrement…' },
  'consents.registered': { pt: 'Consentimento registado.', en: 'Consent registered.', fr: 'Consentement enregistré.' },
  'consents.active': { pt: 'Consentimentos Ativos', en: 'Active Consents', fr: 'Consentements Actifs' },
  'consents.none': { pt: 'Sem consentimentos', en: 'No consents', fr: 'Aucun consentement' },
  'consents.none_desc': { pt: 'Adicione os consentimentos necessários para usufruir de todos os serviços.', en: 'Add the necessary consents to enjoy all services.', fr: 'Ajoutez les consentements nécessaires pour profiter de tous les services.' },
  'consents.accepted_at': { pt: 'Aceite em', en: 'Accepted on', fr: 'Accepté le' },
  'consents.type_data': { pt: 'Partilha de Dados Clínicos', en: 'Clinical Data Sharing', fr: 'Partage de Données Cliniques' },
  'consents.type_teleconsult': { pt: 'Teleconsulta', en: 'Teleconsultation', fr: 'Téléconsultation' },
  'consents.type_prescription': { pt: 'Prescrição Digital', en: 'Digital Prescription', fr: 'Prescription Numérique' },
  'consents.type_notifications': { pt: 'Notificações de Saúde', en: 'Health Notifications', fr: 'Notifications de Santé' },
  'consents.type_research': { pt: 'Investigação Clínica', en: 'Clinical Research', fr: 'Recherche Clinique' },

  /* ═══════════════════════════════════════════════════════════
     DOCTOR PROFILE PAGE
     ═══════════════════════════════════════════════════════════ */
  'doctor.title': { pt: 'Perfil Médico', en: 'Doctor Profile', fr: 'Profil Médecin' },
  'doctor.subtitle': { pt: 'Gerir as suas credenciais e informações profissionais', en: 'Manage your credentials and professional information', fr: 'Gérer vos identifiants et informations professionnelles' },
  'doctor.verification': { pt: 'Estado de verificação:', en: 'Verification status:', fr: 'Statut de vérification :' },
  'doctor.verified': { pt: 'Verificado', en: 'Verified', fr: 'Vérifié' },
  'doctor.pending': { pt: 'Pendente', en: 'Pending', fr: 'En attente' },
  'doctor.rejected': { pt: 'Rejeitado', en: 'Rejected', fr: 'Rejeté' },
  'doctor.professional': { pt: 'Dados Profissionais', en: 'Professional Data', fr: 'Données Professionnelles' },
  'doctor.license': { pt: 'Número de Licença', en: 'License Number', fr: 'Numéro de Licence' },
  'doctor.specialization': { pt: 'Especialização', en: 'Specialization', fr: 'Spécialisation' },
  'doctor.bio': { pt: 'Biografia', en: 'Biography', fr: 'Biographie' },
  'doctor.bio_placeholder': { pt: 'Breve descrição profissional...', en: 'Brief professional description...', fr: 'Brève description professionnelle...' },
  'doctor.save': { pt: 'Guardar', en: 'Save', fr: 'Enregistrer' },
  'doctor.saving': { pt: 'A guardar…', en: 'Saving…', fr: 'Enregistrement…' },
  'doctor.saved': { pt: 'Perfil médico guardado.', en: 'Doctor profile saved.', fr: 'Profil médecin enregistré.' },

  /* ═══════════════════════════════════════════════════════════
     DOCTOR QUEUE PAGE
     ═══════════════════════════════════════════════════════════ */
  'queue.title': { pt: 'Fila de Espera', en: 'Queue', fr: 'File d\'Attente' },
  'queue.subtitle': { pt: 'Consultas pendentes e em curso atribuídas a si', en: 'Pending and ongoing consultations assigned to you', fr: 'Consultations en attente et en cours qui vous sont attribuées' },
  'queue.patients': { pt: 'Pacientes na Fila', en: 'Patients in Queue', fr: 'Patients en File' },
  'queue.empty': { pt: 'Fila vazia', en: 'Queue empty', fr: 'File vide' },
  'queue.empty_desc': { pt: 'Não existem consultas pendentes de momento.', en: 'No pending consultations at the moment.', fr: 'Aucune consultation en attente pour le moment.' },
  'queue.start': { pt: 'Iniciar', en: 'Start', fr: 'Commencer' },
  'queue.complete': { pt: 'Concluir', en: 'Complete', fr: 'Terminer' },

  /* ═══════════════════════════════════════════════════════════
     ADMIN DASHBOARD PAGE
     ═══════════════════════════════════════════════════════════ */
  'admin.label': { pt: 'Administração', en: 'Administration', fr: 'Administration' },
  'admin.title': { pt: 'Dashboard Admin', en: 'Admin Dashboard', fr: 'Tableau de Bord Admin' },
  'admin.subtitle': { pt: 'Métricas da plataforma e indicadores de negócio', en: 'Platform metrics and business indicators', fr: 'Métriques de la plateforme et indicateurs business' },
  'admin.patients': { pt: 'Pacientes', en: 'Patients', fr: 'Patients' },
  'admin.doctors': { pt: 'Médicos', en: 'Doctors', fr: 'Médecins' },
  'admin.pending': { pt: 'Pendentes', en: 'Pending', fr: 'En attente' },
  'admin.active_patients': { pt: 'Pacientes Ativos (30d)', en: 'Active Patients (30d)', fr: 'Patients Actifs (30j)' },
  'admin.consult_month': { pt: 'Consultas (Mês)', en: 'Consultations (Month)', fr: 'Consultations (Mois)' },
  'admin.resolution_rate': { pt: 'Taxa de Resolução', en: 'Resolution Rate', fr: 'Taux de Résolution' },
  'admin.total_consult': { pt: 'Total Consultas', en: 'Total Consultations', fr: 'Total Consultations' },
  'admin.revenue': { pt: 'Receita (Mês)', en: 'Revenue (Month)', fr: 'Revenus (Mois)' },
  'admin.risk_dist': { pt: 'Distribuição de Risco', en: 'Risk Distribution', fr: 'Distribution des Risques' },
  'admin.no_triage_data': { pt: 'Sem dados de triagem.', en: 'No triage data.', fr: 'Aucune donnée de triage.' },
  'admin.attention': { pt: 'Atenção Necessária', en: 'Attention Needed', fr: 'Attention Requise' },
  'admin.pending_doctors': { pt: 'Médico(s) Pendente(s)', en: 'Pending Doctor(s)', fr: 'Médecin(s) en Attente' },
  'admin.pending_desc': { pt: 'Aguardam verificação de credenciais.', en: 'Awaiting credential verification.', fr: 'En attente de vérification des identifiants.' },
  'admin.verify': { pt: 'Verificar', en: 'Verify', fr: 'Vérifier' },
  'admin.urgent_triages': { pt: 'Triagens Urgentes', en: 'Urgent Triages', fr: 'Triages Urgents' },
  'admin.urgent_desc': { pt: 'Classificação de risco URGENTE detectada.', en: 'URGENT risk classification detected.', fr: 'Classification de risque URGENT détectée.' },
  'admin.no_pending': { pt: 'Sem itens pendentes', en: 'No pending items', fr: 'Aucun élément en attente' },

  /* ═══════════════════════════════════════════════════════════
     COMMON / MISC
     ═══════════════════════════════════════════════════════════ */
  'common.loading': { pt: 'A carregar...', en: 'Loading...', fr: 'Chargement...' },
  'common.error': { pt: 'Erro', en: 'Error', fr: 'Erreur' },
  'common.save': { pt: 'Guardar', en: 'Save', fr: 'Enregistrer' },
  'common.cancel': { pt: 'Cancelar', en: 'Cancel', fr: 'Annuler' },
  'common.select': { pt: 'Selecionar', en: 'Select', fr: 'Sélectionner' },
  'common.go_to_page': { pt: 'Ir para a página', en: 'Go to page', fr: 'Aller à la page' },

  /* ═══════════════════════════════════════════════════════════
     CHAT WIDGET
     ═══════════════════════════════════════════════════════════ */
  'chat.open': { pt: 'Abrir assistente', en: 'Open assistant', fr: 'Ouvrir l\'assistant' },
  'chat.close': { pt: 'Fechar', en: 'Close', fr: 'Fermer' },
  'chat.title': { pt: 'Assistente Health', en: 'Health Assistant', fr: 'Assistant Santé' },
  'chat.error': { pt: 'Desculpe, ocorreu um erro. Tente novamente.', en: 'Sorry, an error occurred. Please try again.', fr: 'Désolé, une erreur est survenue. Veuillez réessayer.' },
  'chat.placeholder': { pt: 'Escreva a sua mensagem...', en: 'Type your message...', fr: 'Écrivez votre message...' },
  'chat.send': { pt: 'Enviar', en: 'Send', fr: 'Envoyer' },

  /* ═══════════════════════════════════════════════════════════
     DOCTOR SPECIALIZATIONS (used in DoctorProfilePage select)
     ═══════════════════════════════════════════════════════════ */
  'spec.general': { pt: 'Clínica Geral', en: 'General Practice', fr: 'Médecine Générale' },
  'spec.cardiology': { pt: 'Cardiologia', en: 'Cardiology', fr: 'Cardiologie' },
  'spec.dermatology': { pt: 'Dermatologia', en: 'Dermatology', fr: 'Dermatologie' },
  'spec.pediatrics': { pt: 'Pediatria', en: 'Pediatrics', fr: 'Pédiatrie' },
  'spec.orthopedics': { pt: 'Ortopedia', en: 'Orthopedics', fr: 'Orthopédie' },
  'spec.neurology': { pt: 'Neurologia', en: 'Neurology', fr: 'Neurologie' },
  'spec.gynecology': { pt: 'Ginecologia', en: 'Gynecology', fr: 'Gynécologie' },
  'spec.ophthalmology': { pt: 'Oftalmologia', en: 'Ophthalmology', fr: 'Ophtalmologie' },
  'spec.psychiatry': { pt: 'Psiquiatria', en: 'Psychiatry', fr: 'Psychiatrie' },
  'spec.internal': { pt: 'Medicina Interna', en: 'Internal Medicine', fr: 'Médecine Interne' },
  'spec.surgery': { pt: 'Cirurgia Geral', en: 'General Surgery', fr: 'Chirurgie Générale' },
  'spec.other': { pt: 'Outra', en: 'Other', fr: 'Autre' },

  /* ═══════════════════════════════════════════════════════════
     DASHBOARD TABS
     ═══════════════════════════════════════════════════════════ */
  'dash.score': { pt: 'Score:', en: 'Score:', fr: 'Score :' },
  'dash.tab_summary': { pt: 'Resumo', en: 'Summary', fr: 'Résumé' },
  'dash.tab_triages': { pt: 'Triagens', en: 'Triages', fr: 'Triages' },
  'dash.tab_consultations': { pt: 'Consultas', en: 'Consultations', fr: 'Consultations' },
  'dash.tab_profile': { pt: 'Perfil', en: 'Profile', fr: 'Profil' },

  /* ═══════════════════════════════════════════════════════════
     SELF-CARE PAGE
     ═══════════════════════════════════════════════════════════ */
  'selfcare.title': { pt: 'Autocuidado', en: 'Self-Care', fr: 'Auto-soins' },
  'selfcare.subtitle': { pt: 'Recomendações personalizadas para o seu bem-estar', en: 'Personalized recommendations for your well-being', fr: 'Recommandations personnalisées pour votre bien-être' },
  'selfcare.good_news': { pt: 'Boa notícia!', en: 'Good news!', fr: 'Bonne nouvelle !' },
  'selfcare.low_risk_msg': {
    pt: 'A sua triagem indica risco baixo. Siga estas recomendações de autocuidado e monitorize os seus sintomas.',
    en: 'Your triage indicates low risk. Follow these self-care recommendations and monitor your symptoms.',
    fr: 'Votre triage indique un risque faible. Suivez ces recommandations d\'auto-soins et surveillez vos symptômes.',
  },
  'selfcare.tip_hydration': { pt: 'Mantenha-se hidratado(a)', en: 'Stay hydrated', fr: 'Restez hydraté(e)' },
  'selfcare.tip_hydration_desc': { pt: 'Beba pelo menos 2L de água por dia. Evite bebidas alcoólicas e com cafeína em excesso.', en: 'Drink at least 2L of water per day. Avoid excessive alcohol and caffeine.', fr: 'Buvez au moins 2L d\'eau par jour. Évitez l\'alcool et la caféine en excès.' },
  'selfcare.tip_rest': { pt: 'Descanse adequadamente', en: 'Rest adequately', fr: 'Reposez-vous adéquatement' },
  'selfcare.tip_rest_desc': { pt: 'Durma 7-9 horas por noite. O repouso é essencial para a recuperação.', en: 'Sleep 7-9 hours per night. Rest is essential for recovery.', fr: 'Dormez 7 à 9 heures par nuit. Le repos est essentiel pour la récupération.' },
  'selfcare.tip_monitor': { pt: 'Monitorize os sintomas', en: 'Monitor your symptoms', fr: 'Surveillez vos symptômes' },
  'selfcare.tip_monitor_desc': { pt: 'Se os sintomas piorarem ou surgirem novos, realize uma nova triagem ou consulte um médico.', en: 'If symptoms worsen or new ones appear, perform a new triage or consult a doctor.', fr: 'Si les symptômes s\'aggravent ou de nouveaux apparaissent, effectuez un nouveau triage ou consultez un médecin.' },
  'selfcare.tip_medication': { pt: 'Medicação de venda livre', en: 'Over-the-counter medication', fr: 'Médicaments en vente libre' },
  'selfcare.tip_medication_desc': { pt: 'Para alívio sintomático, pode considerar paracetamol ou ibuprofeno conforme as indicações da embalagem.', en: 'For symptomatic relief, you may consider paracetamol or ibuprofen as per package directions.', fr: 'Pour un soulagement symptomatique, vous pouvez envisager du paracétamol ou de l\'ibuprofène selon les indications de l\'emballage.' },
  'selfcare.tip_diet': { pt: 'Alimentação equilibrada', en: 'Balanced diet', fr: 'Alimentation équilibrée' },
  'selfcare.tip_diet_desc': { pt: 'Prefira alimentos leves e nutritivos. Evite processados e açúcares em excesso.', en: 'Prefer light and nutritious foods. Avoid processed foods and excess sugar.', fr: 'Préférez des aliments légers et nutritifs. Évitez les aliments transformés et le sucre en excès.' },
  'selfcare.tip_exercise': { pt: 'Atividade física moderada', en: 'Moderate physical activity', fr: 'Activité physique modérée' },
  'selfcare.tip_exercise_desc': { pt: 'Se se sentir bem, caminhe ou faça exercício leve. Evite esforços intensos.', en: 'If you feel well, walk or do light exercise. Avoid intense exertion.', fr: 'Si vous vous sentez bien, marchez ou faites de l\'exercice léger. Évitez les efforts intenses.' },
  'selfcare.when_seek': { pt: 'Quando procurar ajuda médica', en: 'When to seek medical help', fr: 'Quand consulter un médecin' },
  'selfcare.seek_desc': { pt: 'Procure atendimento médico se:', en: 'Seek medical care if:', fr: 'Consultez un médecin si :' },
  'selfcare.seek_1': { pt: 'Os sintomas piorarem significativamente', en: 'Symptoms worsen significantly', fr: 'Les symptômes s\'aggravent significativement' },
  'selfcare.seek_2': { pt: 'Surgirem novos sintomas preocupantes', en: 'New concerning symptoms appear', fr: 'De nouveaux symptômes préoccupants apparaissent' },
  'selfcare.seek_3': { pt: 'Febre superior a 38.5°C por mais de 48h', en: 'Fever above 38.5°C for more than 48h', fr: 'Fièvre supérieure à 38,5°C pendant plus de 48h' },
  'selfcare.seek_4': { pt: 'Dificuldade em respirar ou dor intensa', en: 'Difficulty breathing or severe pain', fr: 'Difficulté à respirer ou douleur intense' },
  'selfcare.new_triage': { pt: 'Nova Triagem', en: 'New Triage', fr: 'Nouveau Triage' },
  'selfcare.book_anyway': { pt: 'Marcar Consulta Mesmo Assim', en: 'Book Consultation Anyway', fr: 'Prendre Rendez-vous Quand Même' },
  'selfcare.back_dashboard': { pt: '← Voltar ao Dashboard', en: '← Back to Dashboard', fr: '← Retour au Tableau de Bord' },
  'selfcare.complaint_label': { pt: 'Queixa:', en: 'Complaint:', fr: 'Plainte :' },

  /* ═══════════════════════════════════════════════════════════
     BOOK CONSULTATION MODAL
     ═══════════════════════════════════════════════════════════ */
  'booking.title': { pt: 'Marcar Consulta', en: 'Book Consultation', fr: 'Prendre Rendez-vous' },
  'booking.specialty': { pt: 'Especialidade', en: 'Specialty', fr: 'Spécialité' },
  'booking.specialty_select': { pt: 'Selecionar especialidade', en: 'Select specialty', fr: 'Sélectionner la spécialité' },
  'booking.confirm': { pt: 'Confirmar Marcação', en: 'Confirm Booking', fr: 'Confirmer le Rendez-vous' },
  'booking.confirming': { pt: 'A marcar…', en: 'Booking…', fr: 'Réservation…' },
  'booking.cancel': { pt: 'Cancelar', en: 'Cancel', fr: 'Annuler' },
  'booking.success': { pt: 'Consulta marcada com sucesso!', en: 'Consultation booked successfully!', fr: 'Consultation réservée avec succès !' },
  'booking.error': { pt: 'Erro ao marcar consulta.', en: 'Error booking consultation.', fr: 'Erreur lors de la réservation.' },
  'booking.based_on': { pt: 'Com base na sua triagem:', en: 'Based on your triage:', fr: 'Selon votre triage :' },
  'booking.risk_label': { pt: 'Risco', en: 'Risk', fr: 'Risque' },
};

export default translations;
