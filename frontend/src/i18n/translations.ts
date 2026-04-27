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
     LANDING PAGE (Início) — focused on impact & quick overview
     ═══════════════════════════════════════════════════════════ */
  'landing.hero_desc': {
    pt: 'Gestão de doenças crónicas, prescrições digitais, mapa de clínicas e hospitais e agendamento de consultas — tudo num portal seguro, 24/7.',
    en: 'Chronic disease management, digital prescriptions, clinic and hospital map and appointment scheduling — all in one secure portal, 24/7.',
    fr: 'Gestion des maladies chroniques, prescriptions numériques, carte des cliniques et hôpitaux et prise de rendez-vous — le tout sur un portail sécurisé, 24/7.',
  },
  'landing.enter': { pt: 'Aceder ao Portal', en: 'Access Portal', fr: 'Accéder au Portail' },
  'landing.discover_services': { pt: 'Conhecer Serviços', en: 'Explore Services', fr: 'Découvrir les Services' },
  'landing.stat_patients': { pt: 'Pacientes', en: 'Patients', fr: 'Patients' },
  'landing.stat_doctors': { pt: 'Especialistas', en: 'Specialists', fr: 'Spécialistes' },
  'landing.stat_satisfaction': { pt: 'Satisfação', en: 'Satisfaction', fr: 'Satisfaction' },
  'landing.stat_available': { pt: 'Especialidades', en: 'Specialties', fr: 'Spécialités' },

  'landing.highlights_title': { pt: 'Como funciona', en: 'How It Works', fr: 'Comment ça marche' },
  'landing.highlights_subtitle': { pt: 'Três passos para cuidar da sua saúde', en: 'Three steps to take care of your health', fr: 'Trois étapes pour prendre soin de votre santé' },
  'landing.step1_title': { pt: 'Registo Rápido', en: 'Quick Registration', fr: 'Inscription Rapide' },
  'landing.step1_desc': {
    pt: 'Crie a sua conta em menos de 1 minuto com e-mail ou Google. Sem burocracia.',
    en: 'Create your account in less than 1 minute with email or Google. No paperwork.',
    fr: 'Créez votre compte en moins d\'1 minute avec e-mail ou Google. Sans bureaucratie.',
  },
  'landing.step2_title': { pt: 'Triagem & Encaminhamento', en: 'Triage & Referral', fr: 'Triage & Orientation' },
  'landing.step2_desc': {
    pt: 'O sistema avalia os seus sintomas, classifica o risco e encaminha para a especialidade médica adequada — medicina interna, cardiologia, infecciologia, pneumologia e mais.',
    en: 'The system assesses your symptoms, classifies risk and refers you to the appropriate medical specialty — internal medicine, cardiology, infectology, pulmonology and more.',
    fr: 'Le système évalue vos symptômes, classe le risque et vous oriente vers la spécialité médicale appropriée — médecine interne, cardiologie, infectiologie, pneumologie et plus.',
  },
  'landing.step3_title': { pt: 'Prescrição & Acompanhamento', en: 'Prescription & Follow-up', fr: 'Prescription & Suivi' },
  'landing.step3_desc': {
    pt: 'Receba prescrições digitais, lembretes de medicação e monitorização contínua de doenças crónicas como diabetes, hipertensão, drepanocitose e malária.',
    en: 'Receive digital prescriptions, medication reminders and continuous monitoring of chronic conditions like diabetes, hypertension, sickle cell disease and malaria.',
    fr: 'Recevez des ordonnances numériques, rappels de médicaments et suivi continu des maladies chroniques comme le diabète, l\'hypertension, la drépanocytose et le paludisme.',
  },

  'landing.trust_title': { pt: 'O que a plataforma oferece', en: 'What the platform offers', fr: 'Ce que la plateforme offre' },
  'landing.feature1_title': { pt: 'Mapa de Clínicas & Hospitais', en: 'Clinic & Hospital Map', fr: 'Carte des Cliniques & Hôpitaux' },
  'landing.feature1_desc': { pt: 'Encontre clínicas, hospitais e laboratórios próximos de si no mapa interativo.', en: 'Find clinics, hospitals and laboratories near you on the interactive map.', fr: 'Trouvez des cliniques, hôpitaux et laboratoires proches de vous sur la carte interactive.' },
  'landing.feature2_title': { pt: 'Agendamento Online', en: 'Online Booking', fr: 'Réservation en Ligne' },
  'landing.feature2_desc': { pt: 'Marque consultas com especialistas e visualize a disponibilidade dos médicos em tempo real.', en: 'Book appointments with specialists and view doctor availability in real time.', fr: 'Prenez rendez-vous avec des spécialistes et consultez la disponibilité des médecins en temps réel.' },
  'landing.feature3_title': { pt: 'Gestão de Doenças Crónicas', en: 'Chronic Disease Management', fr: 'Gestion des Maladies Chroniques' },
  'landing.feature3_desc': { pt: 'Registe as suas condições crónicas e receba acompanhamento personalizado com prescrições e lembretes.', en: 'Register your chronic conditions and receive personalized follow-up with prescriptions and reminders.', fr: 'Enregistrez vos conditions chroniques et recevez un suivi personnalisé avec prescriptions et rappels.' },

  'landing.cta_title': { pt: 'Comece a cuidar da sua saúde hoje', en: 'Start taking care of your health today', fr: 'Commencez à prendre soin de votre santé aujourd\'hui' },
  'landing.cta_desc': { pt: 'Triagem inteligente, gestão de doenças crónicas, agendamento de consultas e prescrições digitais — tudo gratuito para começar.', en: 'Intelligent triage, chronic disease management, appointment scheduling and digital prescriptions — all free to get started.', fr: 'Triage intelligent, gestion des maladies chroniques, prise de rendez-vous et prescriptions numériques — tout gratuit pour commencer.' },
  'landing.create_free': { pt: 'Criar Conta Grátis', en: 'Create Free Account', fr: 'Créer un Compte Gratuit' },
  'landing.have_account': { pt: 'Já tenho conta', en: 'I have an account', fr: 'J\'ai un compte' },

  /* ── Landing — Specialties Strip ── */
  'landing.specialties_title': { pt: 'Especialidades Disponíveis', en: 'Available Specialties', fr: 'Spécialités Disponibles' },
  'landing.specialties_subtitle': { pt: 'Aceda a especialistas de diversas áreas através da plataforma', en: 'Access specialists from various fields through the platform', fr: 'Accédez à des spécialistes de différents domaines via la plateforme' },
  'landing.spec_cardiology': { pt: 'Cardiologia', en: 'Cardiology', fr: 'Cardiologie' },
  'landing.spec_endocrinology': { pt: 'Medicina Interna', en: 'Internal Medicine', fr: 'Médecine Interne' },
  'landing.spec_pulmonology': { pt: 'Infecciologia', en: 'Infectious Diseases', fr: 'Infectiologie' },
  'landing.spec_dermatology': { pt: 'Hematologia', en: 'Hematology', fr: 'Hématologie' },
  'landing.spec_neurology': { pt: 'Pneumologia', en: 'Pulmonology', fr: 'Pneumologie' },
  'landing.spec_orthopedics': { pt: 'Gastroenterologia', en: 'Gastroenterology', fr: 'Gastroentérologie' },
  'landing.spec_psychiatry': { pt: 'Nefrologia', en: 'Nephrology', fr: 'Néphrologie' },
  'landing.spec_general': { pt: 'Oncologia', en: 'Oncology', fr: 'Oncologie' },
  'landing.spec_more': { pt: '+12 especialidades', en: '+12 specialties', fr: '+12 spécialités' },

  /* ── Landing — Chronic Diseases Banner ── */
  'landing.chronic_title': { pt: 'Gestão de Doenças Crónicas', en: 'Chronic Disease Management', fr: 'Gestion des Maladies Chroniques' },
  'landing.chronic_subtitle': { pt: 'Acompanhamento contínuo e personalizado para cada condição', en: 'Continuous and personalized follow-up for each condition', fr: 'Suivi continu et personnalisé pour chaque condition' },
  'landing.chronic_diabetes': { pt: 'Diabetes', en: 'Diabetes', fr: 'Diabète' },
  'landing.chronic_diabetes_desc': { pt: 'Monitorização de glicemia, prescrições de insulina e acompanhamento com endocrinologia.', en: 'Blood sugar monitoring, insulin prescriptions and endocrinology follow-up.', fr: 'Surveillance de la glycémie, prescriptions d\'insuline et suivi en endocrinologie.' },
  'landing.chronic_hypertension': { pt: 'Hipertensão', en: 'Hypertension', fr: 'Hypertension' },
  'landing.chronic_hypertension_desc': { pt: 'Registo de tensão arterial, ajuste de medicação e acompanhamento cardiológico.', en: 'Blood pressure tracking, medication adjustments and cardiology follow-up.', fr: 'Suivi de la tension artérielle, ajustement des médicaments et suivi cardiologique.' },
  'landing.chronic_asthma': { pt: 'Asma & DPOC', en: 'Asthma & COPD', fr: 'Asthme & BPCO' },
  'landing.chronic_asthma_desc': { pt: 'Planos de ação personalizados, prescrição de inaladores e teleconsulta com pneumologia.', en: 'Personalized action plans, inhaler prescriptions and pulmonology teleconsultation.', fr: 'Plans d\'action personnalisés, prescriptions d\'inhalateurs et téléconsultation en pneumologie.' },
  'landing.chronic_mental': { pt: 'Epilepsia', en: 'Epilepsy', fr: 'Épilepsie' },
  'landing.chronic_mental_desc': { pt: 'Gestão de crises, prescrição de antiepilépticos e acompanhamento neurológico regular.', en: 'Crisis management, antiepileptic prescriptions and regular neurological follow-up.', fr: 'Gestion des crises, prescription d\'antiépileptiques et suivi neurologique régulier.' },

  /* ═══════════════════════════════════════════════════════════
     ABOUT PAGE (Sobre) — story, team, mission, timeline
     ═══════════════════════════════════════════════════════════ */
  'about.badge': { pt: 'A Nossa História', en: 'Our Story', fr: 'Notre Histoire' },
  'about.hero_title1': { pt: 'Quem', en: 'Who', fr: 'Qui' },
  'about.hero_title2': { pt: 'Somos Nós', en: 'We Are', fr: 'Sommes-Nous' },
  'about.hero_desc': {
    pt: 'Nascemos da convicção de que a tecnologia pode eliminar barreiras no acesso à saúde. Ligamos pacientes a especialistas com segurança, rapidez e humanidade.',
    en: 'We were born from the conviction that technology can eliminate barriers in healthcare access. We connect patients to specialists with safety, speed and humanity.',
    fr: 'Nous sommes nés de la conviction que la technologie peut éliminer les barrières dans l\'accès aux soins. Nous connectons les patients aux spécialistes avec sécurité, rapidité et humanité.',
  },
  'about.mission': { pt: 'A Nossa Missão', en: 'Our Mission', fr: 'Notre Mission' },
  'about.mission_desc': {
    pt: 'Democratizar o acesso a especialidades médicas e à gestão de doenças crónicas através de prescrições digitais, triagem inteligente, agendamento online e um mapa de clínicas e hospitais.',
    en: 'Democratize access to medical specialties and chronic disease management through digital prescriptions, intelligent triage, online booking and a clinic and hospital map.',
    fr: 'Démocratiser l\'accès aux spécialités médicales et à la gestion des maladies chroniques grâce aux prescriptions numériques, au triage intelligent, à la réservation en ligne et à une carte des cliniques et hôpitaux.',
  },
  'about.vision': { pt: 'A Nossa Visão', en: 'Our Vision', fr: 'Notre Vision' },
  'about.vision_desc': {
    pt: 'Ser a plataforma de referência para a saúde digital — com mapa interativo de clínicas e hospitais, agendamento de consultas, gestão de doenças crónicas e prescrições digitais, servindo pacientes e profissionais de saúde de forma integrada.',
    en: 'To be the leading digital health platform — with an interactive clinic and hospital map, appointment scheduling, chronic disease management and digital prescriptions, serving patients and healthcare professionals in an integrated way.',
    fr: 'Être la plateforme de référence pour la santé numérique — avec une carte interactive des cliniques et hôpitaux, prise de rendez-vous, gestion des maladies chroniques et prescriptions numériques, au service des patients et des professionnels de santé de manière intégrée.',
  },

  'about.timeline_title': { pt: 'A Nossa Visão de Progresso', en: 'Our Progress Vision', fr: 'Notre Vision de Progrès' },
  'about.timeline_subtitle': { pt: 'Etapas que planeamos alcançar', en: 'Milestones we plan to achieve', fr: 'Étapes que nous prévoyons d\'atteindre' },
  'about.timeline_2024_q1': { pt: 'Fundação da Health Platform. Motor de triagem v1 e primeiros protótipos da plataforma.', en: 'Health Platform founded. Triage engine v1 and first platform prototypes.', fr: 'Fondation de Health Platform. Moteur de triage v1 et premiers prototypes de la plateforme.' },
  'about.timeline_2024_q3': { pt: 'Lançamento da teleconsulta e integração com clínicas parceiras. Abertura a múltiplas especialidades.', en: 'Teleconsultation launch and integration with partner clinics. Opening to multiple specialties.', fr: 'Lancement de la téléconsultation et intégration avec des cliniques partenaires. Ouverture à plusieurs spécialités.' },
  'about.timeline_2025_q1': { pt: 'Prescrições digitais. Programas de acompanhamento de doenças crónicas. Mapa interativo de clínicas e hospitais.', en: 'Digital prescriptions. Chronic disease follow-up programs. Interactive clinic and hospital map.', fr: 'Prescriptions numériques. Programmes de suivi des maladies chroniques. Carte interactive des cliniques et hôpitaux.' },
  'about.timeline_2025_q4': { pt: 'IA de triagem v2. Agendamento online de consultas. Expansão da rede de especialistas e hospitais parceiros.', en: 'Triage AI v2. Online appointment scheduling. Expansion of specialist network and partner hospitals.', fr: 'IA de triage v2. Prise de rendez-vous en ligne. Expansion du réseau de spécialistes et hôpitaux partenaires.' },

  'about.team_title': { pt: 'A Equipa', en: 'The Team', fr: 'L\'Équipe' },
  'about.team_subtitle': { pt: 'Pessoas apaixonadas por saúde e tecnologia', en: 'People passionate about health and technology', fr: 'Des personnes passionnées par la santé et la technologie' },
  'about.team_clinical': { pt: 'Conselho Clínico & Especialidades', en: 'Clinical Board & Specialties', fr: 'Conseil Clinique & Spécialités' },
  'about.team_clinical_desc': { pt: 'Especialistas médicos que validam protocolos clínicos, supervisionam programas de acompanhamento de doenças crónicas e garantem a qualidade das prescrições digitais.', en: 'Medical specialists who validate clinical protocols, supervise chronic disease follow-up programs and ensure digital prescription quality.', fr: 'Spécialistes médicaux qui valident les protocoles cliniques, supervisent les programmes de suivi des maladies chroniques et assurent la qualité des prescriptions numériques.' },
  'about.team_ops': { pt: 'Operações & Suporte', en: 'Operations & Support', fr: 'Opérations & Support' },
  'about.team_ops_desc': { pt: 'Equipa dedicada ao suporte de pacientes e médicos, disponível para garantir a melhor experiência possível.', en: 'Team dedicated to patient and doctor support, available to ensure the best possible experience.', fr: 'Équipe dédiée au support des patients et médecins, disponible pour assurer la meilleure expérience possible.' },

  'about.cta_title': { pt: 'Quer fazer parte desta missão?', en: 'Want to be part of this mission?', fr: 'Vous voulez faire partie de cette mission ?' },
  'about.cta_desc': { pt: 'Junte-se como paciente, médico ou parceiro. Estamos a construir o futuro da saúde digital.', en: 'Join as a patient, doctor or partner. We are building the future of digital health.', fr: 'Rejoignez-nous en tant que patient, médecin ou partenaire. Nous construisons le futur de la santé numérique.' },
  'about.create_account': { pt: 'Criar Conta', en: 'Create Account', fr: 'Créer un Compte' },

  /* ═══════════════════════════════════════════════════════════
     SERVICES PAGE (Serviços) — detailed service descriptions
     ═══════════════════════════════════════════════════════════ */
  'services.hero_title': { pt: 'Especialidades, Prescrições & Saúde Digital', en: 'Specialties, Prescriptions & Digital Health', fr: 'Spécialités, Prescriptions & Santé Numérique' },
  'services.hero_desc': {
    pt: 'Múltiplas especialidades médicas, prescrições digitais, programas de acompanhamento de doenças crónicas e mapa interativo de clínicas e hospitais — tudo na mesma plataforma.',
    en: 'Multiple medical specialties, digital prescriptions, chronic disease follow-up programs and an interactive clinic and hospital map — all on one platform.',
    fr: 'Multiples spécialités médicales, prescriptions numériques, programmes de suivi des maladies chroniques et carte interactive des cliniques et hôpitaux — le tout sur une seule plateforme.',
  },

  'services.triage_title': { pt: 'Triagem Inteligente', en: 'Intelligent Triage', fr: 'Triage Intelligent' },
  'services.triage_desc': {
    pt: 'Sistema de avaliação baseado em sintomas com classificação de risco automática (verde, amarelo, laranja, vermelho). Protocolos validados por médicos, resultados em menos de 3 minutos.',
    en: 'Symptom-based assessment system with automatic risk classification (green, yellow, orange, red). Doctor-validated protocols, results in under 3 minutes.',
    fr: 'Système d\'évaluation basé sur les symptômes avec classification automatique des risques (vert, jaune, orange, rouge). Protocoles validés par des médecins, résultats en moins de 3 minutes.',
  },
  'services.teleconsult_title': { pt: 'Teleconsulta Médica', en: 'Medical Teleconsultation', fr: 'Téléconsultation Médicale' },
  'services.teleconsult_desc': {
    pt: 'Consultas online com médicos verificados. Agendamento flexível, histórico clínico integrado e prescrição digital. Disponível 7 dias por semana.',
    en: 'Online consultations with verified doctors. Flexible scheduling, integrated clinical history and digital prescriptions. Available 7 days a week.',
    fr: 'Consultations en ligne avec des médecins vérifiés. Planification flexible, historique clinique intégré et prescription numérique. Disponible 7 jours sur 7.',
  },
  'services.prescriptions_title': { pt: 'Prescrições Digitais', en: 'Digital Prescriptions', fr: 'Prescriptions Numériques' },
  'services.prescriptions_desc': {
    pt: 'Receitas médicas digitais enviadas à farmácia da sua escolha. Renovação automática para doenças crónicas, alertas de interações medicamentosas e historial completo de prescrições acessível 24/7.',
    en: 'Digital prescriptions sent to your chosen pharmacy. Automatic renewal for chronic diseases, drug interaction alerts and complete prescription history accessible 24/7.',
    fr: 'Ordonnances numériques envoyées à la pharmacie de votre choix. Renouvellement automatique pour les maladies chroniques, alertes d\'interactions médicamenteuses et historique complet des prescriptions accessible 24/7.',
  },
  'services.followup_title': { pt: 'Doenças Crónicas', en: 'Chronic Diseases', fr: 'Maladies Chroniques' },
  'services.followup_desc': {
    pt: 'Programas de acompanhamento para diabetes, hipertensão, asma, DPOC, epilepsia, drepanocitose, VIH/SIDA, insuficiência renal e outras condições crónicas. Monitorização de sinais vitais, ajuste de medicação e consultas regulares com especialistas.',
    en: 'Follow-up programs for diabetes, hypertension, asthma, COPD, epilepsy, sickle cell disease, HIV/AIDS, kidney failure and other chronic conditions. Vital signs monitoring, medication adjustments and regular specialist consultations.',
    fr: 'Programmes de suivi pour le diabète, l\'hypertension, l\'asthme, la BPCO, l\'épilepsie, la drépanocytose, le VIH/SIDA, l\'insuffisance rénale et d\'autres maladies chroniques. Surveillance des signes vitaux, ajustement des médicaments et consultations régulières avec des spécialistes.',
  },
  'services.corporate_title': { pt: 'Saúde Corporativa', en: 'Corporate Health', fr: 'Santé d\'Entreprise' },
  'services.corporate_desc': {
    pt: 'Painel de saúde ocupacional para empresas. Gestão de colaboradores, relatórios de absentismo, campanhas de vacinação e check-ups periódicos — tudo centralizado.',
    en: 'Occupational health dashboard for companies. Employee management, absenteeism reports, vaccination campaigns and periodic check-ups — all centralized.',
    fr: 'Tableau de bord de santé au travail pour les entreprises. Gestion des employés, rapports d\'absentéisme, campagnes de vaccination et bilans périodiques — le tout centralisé.',
  },
  'services.emergency_title': { pt: 'Especialidades Médicas', en: 'Medical Specialties', fr: 'Spécialités Médicales' },
  'services.emergency_desc': {
    pt: 'Acesso a múltiplas especialidades médicas: cardiologia, medicina interna, neurologia, pneumologia, gastroenterologia, nefrologia, oncologia, dermatologia, endocrinologia, psiquiatria e mais. Ligação direta com clínicas e hospitais parceiros.',
    en: 'Access to multiple medical specialties: cardiology, internal medicine, neurology, pulmonology, gastroenterology, nephrology, oncology, dermatology, endocrinology, psychiatry and more. Direct connection with partner clinics and hospitals.',
    fr: 'Accès à de multiples spécialités médicales : cardiologie, médecine interne, neurologie, pneumologie, gastroentérologie, néphrologie, oncologie, dermatologie, endocrinologie, psychiatrie et plus. Connexion directe avec les cliniques et hôpitaux partenaires.',
  },

  'services.for_patients': { pt: 'Para Pacientes', en: 'For Patients', fr: 'Pour les Patients' },
  'services.for_patients_desc': { pt: 'Gestão de doenças crónicas, prescrições digitais, acesso a múltiplas especialidades, mapa de clínicas e hospitais e teleconsulta — tudo num só lugar.', en: 'Chronic disease management, digital prescriptions, access to multiple specialties, clinic and hospital map and teleconsultation — all in one place.', fr: 'Gestion des maladies chroniques, prescriptions numériques, accès à plusieurs spécialités, carte des cliniques et hôpitaux et téléconsultation — tout en un seul endroit.' },
  'services.for_doctors': { pt: 'Para Médicos', en: 'For Doctors', fr: 'Pour les Médecins' },
  'services.for_doctors_desc': { pt: 'Prescrição digital integrada, painel de doentes crónicos, fila por especialidade e histórico clínico completo num só lugar.', en: 'Integrated digital prescribing, chronic patient dashboard, specialty-based queue and complete clinical history in one place.', fr: 'Prescription numérique intégrée, tableau de bord des patients chroniques, file par spécialité et historique clinique complet en un seul endroit.' },
  'services.for_companies': { pt: 'Para Empresas', en: 'For Companies', fr: 'Pour les Entreprises' },
  'services.for_companies_desc': { pt: 'Programas de prevenção de doenças crónicas, check-ups por especialidade, prescrições corporativas e relatórios de saúde ocupacional.', en: 'Chronic disease prevention programs, specialty check-ups, corporate prescriptions and occupational health reports.', fr: 'Programmes de prévention des maladies chroniques, bilans par spécialité, prescriptions corporate et rapports de santé au travail.' },

  'services.faq_title': { pt: 'Perguntas Frequentes', en: 'Frequently Asked Questions', fr: 'Questions Fréquentes' },
  'services.faq1_q': { pt: 'As prescrições digitais têm validade legal?', en: 'Are digital prescriptions legally valid?', fr: 'Les prescriptions numériques sont-elles légalement valides ?' },
  'services.faq1_a': { pt: 'Sim. As prescrições são emitidas por médicos registados e têm a mesma validade legal que as prescrições em papel. São enviadas directamente à farmácia da sua escolha.', en: 'Yes. Prescriptions are issued by registered doctors and have the same legal validity as paper prescriptions. They are sent directly to your pharmacy of choice.', fr: 'Oui. Les prescriptions sont émises par des médecins inscrits et ont la même validité légale que les prescriptions papier. Elles sont envoyées directement à la pharmacie de votre choix.' },
  'services.faq2_q': { pt: 'Que doenças crónicas são acompanhadas?', en: 'Which chronic diseases are covered?', fr: 'Quelles maladies chroniques sont suivies ?' },
  'services.faq2_a': { pt: 'Acompanhamos diabetes (tipo 1 e 2), hipertensão arterial, asma, DPOC, epilepsia, drepanocitose, VIH/SIDA, insuficiência renal, doenças cardíacas, artrite reumatóide e muitas mais. Cada programa inclui monitorização, prescrições e consultas regulares com especialistas.', en: 'We cover type 1 and 2 diabetes, arterial hypertension, asthma, COPD, epilepsy, sickle cell disease, HIV/AIDS, kidney failure, heart disease, rheumatoid arthritis and many more. Each program includes monitoring, prescriptions and regular specialist consultations.', fr: 'Nous couvrons le diabète (type 1 et 2), l\'hypertension artérielle, l\'asthme, la BPCO, l\'épilepsie, la drépanocytose, le VIH/SIDA, l\'insuffisance rénale, les maladies cardiaques, la polyarthrite rhumatoïde et bien d\'autres. Chaque programme comprend la surveillance, les prescriptions et les consultations régulières avec des spécialistes.' },
  'services.faq3_q': { pt: 'Que especialidades médicas estão disponíveis?', en: 'Which medical specialties are available?', fr: 'Quelles spécialités médicales sont disponibles ?' },
  'services.faq3_a': { pt: 'Disponibilizamos múltiplas especialidades: cardiologia, medicina interna, neurologia, pneumologia, gastroenterologia, nefrologia, oncologia, dermatologia, endocrinologia, psiquiatria, geriatria e outras. A rede de clínicas e hospitais parceiros está em constante crescimento.', en: 'We offer multiple specialties: cardiology, internal medicine, neurology, pulmonology, gastroenterology, nephrology, oncology, dermatology, endocrinology, psychiatry, geriatrics and others. Our partner clinic and hospital network is constantly growing.', fr: 'Nous proposons de multiples spécialités : cardiologie, médecine interne, neurologie, pneumologie, gastroentérologie, néphrologie, oncologie, dermatologie, endocrinologie, psychiatrie, gériatrie et autres. Notre réseau de cliniques et hôpitaux partenaires est en constante croissance.' },
  'services.faq4_q': { pt: 'Posso renovar prescrições de doenças crónicas automaticamente?', en: 'Can I automatically renew chronic disease prescriptions?', fr: 'Puis-je renouveler automatiquement les prescriptions de maladies chroniques ?' },
  'services.faq4_a': { pt: 'Sim. As prescrições de medicação crónica podem ser renovadas automaticamente após validação pelo seu médico. Recebe notificações antes do fim de cada ciclo.', en: 'Yes. Chronic medication prescriptions can be automatically renewed after validation by your doctor. You receive notifications before each cycle ends.', fr: 'Oui. Les prescriptions de médicaments chroniques peuvent être renouvelées automatiquement après validation par votre médecin. Vous recevez des notifications avant la fin de chaque cycle.' },
  'services.faq5_q': { pt: 'Posso usar a plataforma para a minha empresa?', en: 'Can I use the platform for my company?', fr: 'Puis-je utiliser la plateforme pour mon entreprise ?' },
  'services.faq5_a': { pt: 'Sim! A plataforma oferece gestão de doenças crónicas dos colaboradores, prescrições corporativas, consultas com todas as especialidades e relatórios de saúde ocupacional.', en: 'Yes! The platform offers employee chronic disease management, corporate prescriptions, consultations across all specialties and occupational health reports.', fr: 'Oui ! La plateforme offre la gestion des maladies chroniques des employés, les prescriptions corporate, les consultations dans toutes les spécialités et les rapports de santé au travail.' },

  /* ═══════════════════════════════════════════════════════════
     TRIAGE — start flow additions (age group + category)
     ═══════════════════════════════════════════════════════════ */
  'triage.age_group': { pt: 'Para quem é a triagem?', en: 'Who is the triage for?', fr: 'Pour qui est le triage ?' },
  'triage.age_adult': { pt: 'Adulto', en: 'Adult', fr: 'Adulte' },
  'triage.age_child': { pt: 'Criança', en: 'Child', fr: 'Enfant' },
  'triage.answered_by_parent': { pt: 'Estou a responder como pai/mãe ou responsável', en: 'I am answering as a parent/guardian', fr: 'Je réponds en tant que parent/tuteur' },

  'triage.category': { pt: 'Categoria', en: 'Category', fr: 'Catégorie' },
  'triage.cat_general': { pt: 'Geral / Não sei', en: 'General / Not sure', fr: 'Général / Je ne sais pas' },
  'triage.cat_respiratory': { pt: 'Respiração (tosse, falta de ar)', en: 'Breathing (cough, shortness of breath)', fr: 'Respiration (toux, essoufflement)' },
  'triage.cat_cardiac': { pt: 'Coração / Peito', en: 'Heart / Chest', fr: 'Cœur / Poitrine' },
  'triage.cat_neuro': { pt: 'Neurológico (cabeça, tonturas, convulsões)', en: 'Neurologic (head, dizziness, seizures)', fr: 'Neurologique (tête, vertiges, crises)' },
  'triage.cat_gi': { pt: 'Gastrointestinal (dor abdominal, vómitos, diarreia)', en: 'Gastrointestinal (abdominal pain, vomiting, diarrhea)', fr: 'Gastro-intestinal (douleur abdominale, vomissements, diarrhée)' },
  'triage.cat_urinary': { pt: 'Urinário / Genital', en: 'Urinary / Genital', fr: 'Urinaire / Génital' },
  'triage.cat_skin': { pt: 'Pele (alergia, erupção)', en: 'Skin (allergy, rash)', fr: 'Peau (allergie, éruption)' },
  'triage.cat_injury': { pt: 'Trauma / Lesão', en: 'Trauma / Injury', fr: 'Traumatisme / Blessure' },
  'triage.cat_mental': { pt: 'Saúde mental', en: 'Mental health', fr: 'Santé mentale' },
  'triage.cat_womens': { pt: 'Saúde da mulher / Gravidez', en: "Women's health / Pregnancy", fr: 'Santé de la femme / Grossesse' },
  'triage.cat_medication': { pt: 'Medicação (efeitos, dose, reação)', en: 'Medication (effects, dose, reaction)', fr: 'Médicaments (effets, dose, réaction)' },
  'triage.cat_chronic': { pt: 'Doença crónica (controlo, crise)', en: 'Chronic condition (control, flare)', fr: 'Maladie chronique (contrôle, crise)' },

   'triage.summary': { pt: 'Resumo', en: 'Summary', fr: 'Résumé' },

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

  /* Dashboard — Quick Actions (La Meva Salut) */
  'dash.quick_actions': { pt: 'Acesso Rápido', en: 'Quick Access', fr: 'Accès Rapide' },
  'dash.qa_triage': { pt: 'Triagem', en: 'Triage', fr: 'Triage' },
  'dash.qa_appointments': { pt: 'Consultas', en: 'Appointments', fr: 'Rendez-vous' },
  'dash.qa_medication': { pt: 'Medicação', en: 'Medication', fr: 'Médicaments' },
  'dash.qa_econsulta': { pt: 'eConsulta', en: 'eConsult', fr: 'eConsultation' },
  'dash.qa_doctors': { pt: 'Médicos', en: 'Doctors', fr: 'Médecins' },
  'dash.qa_results': { pt: 'Resultados', en: 'Results', fr: 'Résultats' },
  'dash.qa_consents': { pt: 'Consentimentos', en: 'Consents', fr: 'Consentements' },
  'dash.qa_profile': { pt: 'Perfil', en: 'Profile', fr: 'Profil' },

  /* Dashboard — Highlights / Destaques */
  'dash.highlights': { pt: 'Destaques', en: 'Highlights', fr: 'En vedette' },
  'dash.hl_hydration': { pt: 'Mantenha-se hidratado', en: 'Stay hydrated', fr: 'Restez hydraté(e)' },
  'dash.hl_hydration_desc': { pt: 'Beba pelo menos 2L de água por dia para manter o corpo saudável.', en: 'Drink at least 2L of water per day to keep your body healthy.', fr: 'Buvez au moins 2L d\'eau par jour pour garder votre corps en bonne santé.' },
  'dash.hl_sleep': { pt: 'Durma bem', en: 'Sleep well', fr: 'Dormez bien' },
  'dash.hl_sleep_desc': { pt: '7 a 9 horas de sono por noite são essenciais para a recuperação.', en: '7 to 9 hours of sleep per night are essential for recovery.', fr: '7 à 9 heures de sommeil par nuit sont essentielles pour la récupération.' },
  'dash.hl_nutrition': { pt: 'Alimentação equilibrada', en: 'Balanced diet', fr: 'Alimentation équilibrée' },
  'dash.hl_nutrition_desc': { pt: 'Inclua frutas, vegetais e proteínas na sua dieta diária.', en: 'Include fruits, vegetables and proteins in your daily diet.', fr: 'Incluez des fruits, des légumes et des protéines dans votre alimentation quotidienne.' },
  'dash.hl_checkup': { pt: 'Check-up regular', en: 'Regular check-up', fr: 'Bilan régulier' },
  'dash.hl_checkup_desc': { pt: 'Realize exames preventivos pelo menos uma vez por ano.', en: 'Have preventive exams at least once a year.', fr: 'Faites des examens préventifs au moins une fois par an.' },

  /* Dashboard — Chronic Diseases Section */
  'dash.chronic_title': { pt: 'Doenças Crónicas', en: 'Chronic Diseases', fr: 'Maladies Chroniques' },
  'dash.no_chronic': { pt: 'Sem condições crónicas registadas', en: 'No chronic conditions registered', fr: 'Aucune condition chronique enregistrée' },
  'dash.no_chronic_desc': { pt: 'Adicione as suas condições crónicas no perfil para acompanhamento personalizado.', en: 'Add your chronic conditions in your profile for personalized follow-up.', fr: 'Ajoutez vos conditions chroniques dans votre profil pour un suivi personnalisé.' },
  'dash.chronic_tip_diabetes': { pt: 'Monitorize a glicemia regularmente. Mantenha uma dieta equilibrada, pratique exercício e tome a medicação conforme prescrito.', en: 'Monitor blood sugar regularly. Maintain a balanced diet, exercise and take medication as prescribed.', fr: 'Surveillez votre glycémie régulièrement. Maintenez une alimentation équilibrée, faites de l\'exercice et prenez vos médicaments comme prescrit.' },
  'dash.chronic_tip_hypertension': { pt: 'Controle a pressão arterial diariamente. Reduza o sal, faça exercício regular e tome a medicação anti-hipertensiva conforme indicado.', en: 'Monitor blood pressure daily. Reduce salt intake, exercise regularly and take antihypertensive medication as directed.', fr: 'Contrôlez votre tension artérielle quotidiennement. Réduisez le sel, faites de l\'exercice régulièrement et prenez vos médicaments antihypertenseurs comme indiqué.' },
  'dash.chronic_tip_asthma': { pt: 'Tenha sempre o inalador de resgate consigo. Evite alérgenos conhecidos, poluição e fumo. Siga o plano de ação para crises.', en: 'Always carry your rescue inhaler. Avoid known allergens, pollution and smoke. Follow your crisis action plan.', fr: 'Ayez toujours votre inhalateur de secours. Évitez les allergènes connus, la pollution et la fumée. Suivez votre plan d\'action pour les crises.' },
  'dash.chronic_tip_copd': { pt: 'Não fume e evite fumo passivo. Use broncodilatadores conforme prescrito e faça reabilitação pulmonar se indicado.', en: 'Do not smoke and avoid secondhand smoke. Use bronchodilators as prescribed and attend pulmonary rehabilitation if indicated.', fr: 'Ne fumez pas et évitez le tabagisme passif. Utilisez les bronchodilatateurs comme prescrit et participez à la réhabilitation pulmonaire si indiqué.' },
  'dash.chronic_tip_epilepsy': { pt: 'Tome a medicação antiepiléptica todos os dias à mesma hora. Evite privação de sono, álcool em excesso e situações de stress extremo. Informe quem o rodeia sobre como agir numa crise.', en: 'Take antiepileptic medication every day at the same time. Avoid sleep deprivation, excessive alcohol and extreme stress. Inform those around you about how to act during a seizure.', fr: 'Prenez vos médicaments antiépileptiques tous les jours à la même heure. Évitez le manque de sommeil, l\'alcool excessif et le stress extrême. Informez votre entourage sur la conduite à tenir en cas de crise.' },
  'dash.chronic_tip_sickle': { pt: 'Mantenha-se hidratado e evite temperaturas extremas. Tome ácido fólico conforme prescrito e procure assistência médica em caso de crise de dor.', en: 'Stay hydrated and avoid extreme temperatures. Take folic acid as prescribed and seek medical attention during pain crises.', fr: 'Restez hydraté(e) et évitez les températures extrêmes. Prenez l\'acide folique comme prescrit et consultez en cas de crise douloureuse.' },
  'dash.chronic_tip_hiv': { pt: 'Tome a terapia antirretroviral diariamente sem interrupções. Faça análises regulares de carga viral e CD4. Mantenha consultas de acompanhamento.', en: 'Take antiretroviral therapy daily without interruptions. Have regular viral load and CD4 tests. Keep follow-up appointments.', fr: 'Prenez votre traitement antirétroviral quotidiennement sans interruption. Faites des analyses régulières de charge virale et CD4. Maintenez vos rendez-vous de suivi.' },
  'dash.chronic_tip_tb': { pt: 'Complete todo o tratamento prescrito, mesmo que se sinta melhor. Tome os medicamentos à mesma hora todos os dias. Consultas de controlo são essenciais.', en: 'Complete the entire prescribed treatment, even if you feel better. Take medications at the same time every day. Follow-up appointments are essential.', fr: 'Complétez l\'intégralité du traitement prescrit, même si vous vous sentez mieux. Prenez vos médicaments à la même heure chaque jour. Les consultations de contrôle sont essentielles.' },
  'dash.chronic_tip_kidney': { pt: 'Controle a pressão arterial e a glicemia. Siga a dieta renal prescrita (reduza potássio, fósforo e sal). Não falte às sessões de diálise se indicadas.', en: 'Control blood pressure and blood sugar. Follow the prescribed renal diet (reduce potassium, phosphorus and salt). Do not miss dialysis sessions if indicated.', fr: 'Contrôlez votre tension artérielle et votre glycémie. Suivez le régime rénal prescrit (réduisez le potassium, le phosphore et le sel). Ne manquez pas les séances de dialyse si indiquées.' },
  'dash.chronic_tip_heart': { pt: 'Faça exercício moderado regularmente. Controle o colesterol e a pressão arterial. Tome a medicação cardíaca conforme prescrito.', en: 'Exercise moderately and regularly. Control cholesterol and blood pressure. Take cardiac medication as prescribed.', fr: 'Faites de l\'exercice modéré régulièrement. Contrôlez votre cholestérol et votre tension artérielle. Prenez vos médicaments cardiaques comme prescrit.' },
  'dash.chronic_tip_arthritis': { pt: 'Pratique exercício de baixo impacto (natação, caminhada). Tome anti-inflamatórios conforme prescrito. Consulte reumatologista regularmente.', en: 'Practice low-impact exercise (swimming, walking). Take anti-inflammatory medication as prescribed. See your rheumatologist regularly.', fr: 'Pratiquez des exercices à faible impact (natation, marche). Prenez vos anti-inflammatoires comme prescrit. Consultez votre rhumatologue régulièrement.' },
  'dash.chronic_tip_parkinson': { pt: 'Tome a medicação nos horários exactos. Faça fisioterapia e exercícios de equilíbrio. Mantenha acompanhamento neurológico regular.', en: 'Take medication at exact times. Do physiotherapy and balance exercises. Maintain regular neurological follow-up.', fr: 'Prenez vos médicaments aux heures exactes. Faites de la physiothérapie et des exercices d\'équilibre. Maintenez un suivi neurologique régulier.' },
  'dash.chronic_tip_alzheimer': { pt: 'Mantenha rotinas diárias estáveis. Estimule a mente com jogos e leitura. O acompanhamento neurológico é essencial para ajustar a medicação.', en: 'Maintain stable daily routines. Stimulate the mind with games and reading. Neurological follow-up is essential to adjust medication.', fr: 'Maintenez des routines quotidiennes stables. Stimulez votre esprit avec des jeux et de la lecture. Le suivi neurologique est essentiel pour ajuster les médicaments.' },
  'dash.chronic_tip_ms': { pt: 'Siga a terapia modificadora de doença prescrita. Faça reabilitação física regular. Evite calor excessivo que pode agravar sintomas.', en: 'Follow prescribed disease-modifying therapy. Do regular physical rehabilitation. Avoid excessive heat that can worsen symptoms.', fr: 'Suivez la thérapie modificatrice de la maladie prescrite. Faites de la réhabilitation physique régulière. Évitez la chaleur excessive qui peut aggraver les symptômes.' },
  'dash.chronic_tip_fibromyalgia': { pt: 'Durma 7-9 horas por noite. Faça exercício aeróbico suave regularmente. Técnicas de relaxamento podem ajudar a gerir a dor.', en: 'Sleep 7-9 hours per night. Do gentle aerobic exercise regularly. Relaxation techniques can help manage pain.', fr: 'Dormez 7 à 9 heures par nuit. Faites de l\'exercice aérobique doux régulièrement. Les techniques de relaxation peuvent aider à gérer la douleur.' },
  'dash.chronic_tip_default': { pt: 'Siga o plano de tratamento do seu médico. Mantenha consultas regulares e tome a medicação conforme prescrito.', en: 'Follow your doctor\'s treatment plan. Keep regular appointments and take medication as prescribed.', fr: 'Suivez le plan de traitement de votre médecin. Maintenez des consultations régulières et prenez vos médicaments comme prescrit.' },

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

  /* ═══════════════════════════════════════════════════════════
     MEDICATIONS & PRESCRIPTIONS
     ═══════════════════════════════════════════════════════════ */
  'meds.title': { pt: 'Medicações Actuais', en: 'Current Medications', fr: 'Médicaments Actuels' },
  'meds.add': { pt: 'Adicionar Medicação', en: 'Add Medication', fr: 'Ajouter Médicament' },
  'meds.none': { pt: 'Nenhuma medicação registada.', en: 'No medications registered.', fr: 'Aucun médicament enregistré.' },
  'meds.none_hint': { pt: 'Adicione as suas medicações para que apareçam no autocuidado e triagem.', en: 'Add your medications to have them appear in self-care and triage.', fr: 'Ajoutez vos médicaments pour qu\'ils apparaissent dans les soins et le triage.' },
  'meds.name': { pt: 'Nome do medicamento', en: 'Medication name', fr: 'Nom du médicament' },
  'meds.dosage': { pt: 'Dosagem (ex: 500mg)', en: 'Dosage (e.g.: 500mg)', fr: 'Posologie (ex : 500mg)' },
  'meds.frequency': { pt: 'Frequência (ex: 1×/dia)', en: 'Frequency (e.g.: 1×/day)', fr: 'Fréquence (ex : 1×/jour)' },
  'meds.renew': { pt: 'Pedir Renovação', en: 'Request Renewal', fr: 'Demander Renouvellement' },
  'meds.renew_sent': { pt: 'Pedido enviado!', en: 'Request sent!', fr: 'Demande envoyée !' },
  'meds.renew_error': { pt: 'Erro ao enviar pedido.', en: 'Error sending request.', fr: 'Erreur lors de l\'envoi.' },
  'meds.remove': { pt: 'Remover', en: 'Remove', fr: 'Supprimer' },
  'meds.save': { pt: 'Guardar', en: 'Save', fr: 'Enregistrer' },

  /* ═══════════════════════════════════════════════════════════
     FAMILY / DEPENDENTS
     ═══════════════════════════════════════════════════════════ */
  'family.title': { pt: 'Perfis Familiares', en: 'Family Profiles', fr: 'Profils Familiaux' },
  'family.subtitle': { pt: 'Gerir contas de menores e dependentes ligadas ao seu perfil', en: 'Manage minors and dependent accounts linked to your profile', fr: 'Gérer les mineurs et dépendants liés à votre profil' },
  'family.add': { pt: 'Adicionar Familiar', en: 'Add Family Member', fr: 'Ajouter Membre' },
  'family.none': { pt: 'Nenhum perfil familiar registado.', en: 'No family profiles registered.', fr: 'Aucun profil familial enregistré.' },
  'family.name': { pt: 'Nome completo', en: 'Full name', fr: 'Nom complet' },
  'family.dob': { pt: 'Data de nascimento', en: 'Date of birth', fr: 'Date de naissance' },
  'family.rel': { pt: 'Relação', en: 'Relationship', fr: 'Relation' },
  'family.rel_son': { pt: 'Filho', en: 'Son', fr: 'Fils' },
  'family.rel_daughter': { pt: 'Filha', en: 'Daughter', fr: 'Fille' },
  'family.rel_other': { pt: 'Outro', en: 'Other', fr: 'Autre' },
  'family.minor_badge': { pt: 'Menor de 16 anos', en: 'Under 16', fr: 'Moins de 16 ans' },
  'family.triage_for': { pt: 'Fazer Triagem', en: 'Start Triage', fr: 'Commencer Triage' },
  'family.remove': { pt: 'Remover', en: 'Remove', fr: 'Supprimer' },
  'family.save': { pt: 'Guardar Familiar', en: 'Save Member', fr: 'Enregistrer Membre' },
  'family.cancel_add': { pt: 'Cancelar', en: 'Cancel', fr: 'Annuler' },
  'family.minor_note': { pt: 'Perfil pediátrico — triagem com modo criança activa', en: 'Pediatric profile — triage in child mode', fr: 'Profil pédiatrique — triage en mode enfant' },

  /* ═══════════════════════════════════════════════════════════
     VITALS & DEVICES (TRIAGE)
     ═══════════════════════════════════════════════════════════ */
  'vitals.title': { pt: 'Sinais Vitais (opcional)', en: 'Vital Signs (optional)', fr: 'Signes Vitaux (optionnel)' },
  'vitals.manual': { pt: 'Inserção manual', en: 'Manual entry', fr: 'Saisie manuelle' },
  'vitals.device': { pt: 'Ligar dispositivo', en: 'Connect device', fr: 'Connecter appareil' },
  'vitals.bp_sys': { pt: 'Tensão sistólica (mmHg)', en: 'Systolic BP (mmHg)', fr: 'Pression systolique (mmHg)' },
  'vitals.bp_dia': { pt: 'Tensão diastólica (mmHg)', en: 'Diastolic BP (mmHg)', fr: 'Pression diastolique (mmHg)' },
  'vitals.spo2': { pt: 'SpO₂ (%)', en: 'SpO₂ (%)', fr: 'SpO₂ (%)' },
  'vitals.temp': { pt: 'Temperatura (°C)', en: 'Temperature (°C)', fr: 'Température (°C)' },
  'vitals.glucose': { pt: 'Glicémia (mg/dL)', en: 'Blood Glucose (mg/dL)', fr: 'Glycémie (mg/dL)' },
  'vitals.bt_scan': { pt: 'Procurar via Bluetooth', en: 'Scan via Bluetooth', fr: 'Scanner via Bluetooth' },
  'vitals.bt_scanning': { pt: 'A procurar…', en: 'Scanning…', fr: 'Recherche…' },
  'vitals.wifi_label': { pt: 'IP do dispositivo (WiFi)', en: 'Device IP (WiFi)', fr: 'IP de l\'appareil (WiFi)' },
  'vitals.connect': { pt: 'Ligar', en: 'Connect', fr: 'Connecter' },
  'vitals.connected': { pt: 'Ligado', en: 'Connected', fr: 'Connecté' },
  'vitals.read': { pt: 'Ler valores', en: 'Read values', fr: 'Lire les valeurs' },
  'vitals.not_supported': { pt: 'Bluetooth não disponível neste browser.', en: 'Bluetooth not available in this browser.', fr: 'Bluetooth non disponible dans ce navigateur.' },

  /* TRIAGE — dependent selector */
  'triage.for_whom': { pt: 'Para quem é a triagem?', en: 'Who is this triage for?', fr: 'Pour qui est ce triage ?' },
  'triage.for_me': { pt: 'Para mim', en: 'For me', fr: 'Pour moi' },
  'triage.for_dependent': { pt: 'Para um familiar', en: 'For a family member', fr: 'Pour un membre de la famille' },
};

export default translations;
