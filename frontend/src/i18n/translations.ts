/**
 * Translation keys for Health Platform — PT / EN / FR.
 *
 * Convention: keys are flat, dot-separated for readability.
 * Use t('section.key') to retrieve the translation for the active language.
 */

export type Lang = 'pt' | 'en' | 'fr' | 'es';

export const LANG_LABELS: Record<Lang, string> = { pt: 'Português', en: 'English', fr: 'Français', es: 'Español' };
export const LANG_FLAGS: Record<Lang, string> = { pt: '🇵🇹', en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸' };

const translations: Record<string, Record<Lang, string>> = {
  /* ═══════════════════════════════════════════════════════════
     NAVBAR & FOOTER (public)
     ═══════════════════════════════════════════════════════════ */
  'nav.home': { pt: 'Início', en: 'Home', fr: 'Accueil', es: 'Inicio' },
  'nav.about': { pt: 'Sobre', en: 'About', fr: 'À propos', es: 'Sobre nosotros' },
  'nav.services': { pt: 'Serviços', en: 'Services', fr: 'Services', es: 'Servicios' },
  'nav.portal': { pt: 'Portal', en: 'Portal', fr: 'Portail', es: 'Portal' },

  'footer.brand_desc': {
    pt: 'Plataforma digital de triagem inteligente e teleconsulta médica. Conectamos pacientes a profissionais de saúde de forma segura e eficiente.',
    en: 'Digital platform for intelligent triage and medical teleconsultation. We connect patients to healthcare professionals securely and efficiently.',
    fr: 'Plateforme numérique de triage intelligent et de téléconsultation médicale. Nous connectons les patients aux professionnels de santé de manière sécurisée et efficace.',
    es: 'Plataforma digital de triaje inteligente y teleconsulta médica. Conectamos pacientes con profesionales de salud de forma segura y eficiente.',
  },
  'footer.platform': { pt: 'Plataforma', en: 'Platform', fr: 'Plateforme', es: 'Plataforma' },
  'footer.about_us': { pt: 'Sobre Nós', en: 'About Us', fr: 'À propos', es: 'Sobre Nosotros' },
  'footer.services': { pt: 'Serviços', en: 'Services', fr: 'Services', es: 'Servicios' },
  'footer.services_list.triage': { pt: 'Triagem Inteligente', en: 'Intelligent Triage', fr: 'Triage Intelligent', es: 'Triaje Inteligente' },
  'footer.services_list.teleconsult': { pt: 'Teleconsulta', en: 'Teleconsultation', fr: 'Téléconsultation', es: 'Teleconsulta' },
  'footer.services_list.prescriptions': { pt: 'Prescrições Digitais', en: 'Digital Prescriptions', fr: 'Prescriptions Numériques', es: 'Recetas Digitales' },
  'footer.services_list.management': { pt: 'Gestão Clínica', en: 'Clinical Management', fr: 'Gestion Clinique', es: 'Gestión Clínica' },
  'footer.contact': { pt: 'Contacto', en: 'Contact', fr: 'Contact', es: 'Contacto' },
  'footer.rights': { pt: 'Todos os direitos reservados.', en: 'All rights reserved.', fr: 'Tous droits réservés.', es: 'Todos los derechos reservados.' },
  'footer.privacy': { pt: 'Privacidade', en: 'Privacy', fr: 'Confidentialité', es: 'Privacidad' },
  'footer.terms': { pt: 'Termos', en: 'Terms', fr: 'Conditions', es: 'Términos' },

  /* ═══════════════════════════════════════════════════════════
     LANDING PAGE (Início) — focused on impact & quick overview
     ═══════════════════════════════════════════════════════════ */
  'landing.hero_desc': {
    pt: 'Gestão de doenças crónicas, prescrições digitais, mapa de clínicas e hospitais e agendamento de consultas — tudo num portal seguro, 24/7.',
    en: 'Chronic disease management, digital prescriptions, clinic and hospital map and appointment scheduling — all in one secure portal, 24/7.',
    fr: 'Gestion des maladies chroniques, prescriptions numériques, carte des cliniques et hôpitaux et prise de rendez-vous — le tout sur un portail sécurisé, 24/7.',
    es: 'Gestión de enfermedades crónicas, recetas digitales, mapa de clínicas y hospitales y programación de citas — todo en un portal seguro, 24/7.',
  },
  'landing.enter': { pt: 'Aceder ao Portal', en: 'Access Portal', fr: 'Accéder au Portail', es: 'Acceder al Portal' },
  'landing.discover_services': { pt: 'Conhecer Serviços', en: 'Explore Services', fr: 'Découvrir les Services', es: 'Explorar Servicios' },
  'landing.stat_patients': { pt: 'Pacientes', en: 'Patients', fr: 'Patients', es: 'Pacientes' },
  'landing.stat_doctors': { pt: 'Especialistas', en: 'Specialists', fr: 'Spécialistes', es: 'Especialistas' },
  'landing.stat_satisfaction': { pt: 'Satisfação', en: 'Satisfaction', fr: 'Satisfaction', es: 'Satisfacción' },
  'landing.stat_available': { pt: 'Especialidades', en: 'Specialties', fr: 'Spécialités', es: 'Especialidades' },

  'landing.highlights_title': { pt: 'Como funciona', en: 'How It Works', fr: 'Comment ça marche', es: 'Cómo funciona' },
  'landing.highlights_subtitle': { pt: 'Três passos para cuidar da sua saúde', en: 'Three steps to take care of your health', fr: 'Trois étapes pour prendre soin de votre santé', es: 'Tres pasos para cuidar tu salud' },
  'landing.step1_title': { pt: 'Registo Rápido', en: 'Quick Registration', fr: 'Inscription Rapide', es: 'Registro Rápido' },
  'landing.step1_desc': {
    pt: 'Crie a sua conta em menos de 1 minuto com e-mail ou Google. Sem burocracia.',
    en: 'Create your account in less than 1 minute with email or Google. No paperwork.',
    fr: 'Créez votre compte en moins d\'1 minute avec e-mail ou Google. Sans bureaucratie.',
    es: 'Crea tu cuenta en menos de 1 minuto con email o Google. Sin burocracia.',
  },
  'landing.step2_title': { pt: 'Triagem & Encaminhamento', en: 'Triage & Referral', fr: 'Triage & Orientation', es: 'Triaje y Derivación' },
  'landing.step2_desc': {
    pt: 'O sistema avalia os seus sintomas, classifica o risco e encaminha para a especialidade médica adequada — medicina interna, cardiologia, infecciologia, pneumologia e mais.',
    en: 'The system assesses your symptoms, classifies risk and refers you to the appropriate medical specialty — internal medicine, cardiology, infectology, pulmonology and more.',
    fr: 'Le système évalue vos symptômes, classe le risque et vous oriente vers la spécialité médicale appropriée — médecine interne, cardiologie, infectiologie, pneumologie et plus.',
    es: 'El sistema evalúa tus síntomas, clasifica el riesgo y te deriva a la especialidad médica adecuada — medicina interna, cardiología, infectología, neumología y más.',
  },
  'landing.step3_title': { pt: 'Prescrição & Acompanhamento', en: 'Prescription & Follow-up', fr: 'Prescription & Suivi', es: 'Receta y Seguimiento' },
  'landing.step3_desc': {
    pt: 'Receba prescrições digitais, lembretes de medicação e monitorização contínua de doenças crónicas como diabetes, hipertensão, drepanocitose e malária.',
    en: 'Receive digital prescriptions, medication reminders and continuous monitoring of chronic conditions like diabetes, hypertension, sickle cell disease and malaria.',
    fr: 'Recevez des ordonnances numériques, rappels de médicaments et suivi continu des maladies chroniques comme le diabète, l\'hypertension, la drépanocytose et le paludisme.',
    es: 'Recibe recetas digitales, recordatorios de medicación y monitorización continua de enfermedades crónicas como diabetes, hipertensión, drepanocitosis y malaria.',
  },

  'landing.trust_title': { pt: 'O que a plataforma oferece', en: 'What the platform offers', fr: 'Ce que la plateforme offre', es: 'Lo que ofrece la plataforma' },
  'landing.feature1_title': { pt: 'Mapa de Clínicas & Hospitais', en: 'Clinic & Hospital Map', fr: 'Carte des Cliniques & Hôpitaux', es: 'Mapa de Clínicas y Hospitales' },
  'landing.feature1_desc': { pt: 'Encontre clínicas, hospitais e laboratórios próximos de si no mapa interativo.', en: 'Find clinics, hospitals and laboratories near you on the interactive map.', fr: 'Trouvez des cliniques, hôpitaux et laboratoires proches de vous sur la carte interactive.', es: 'Encuentra clínicas, hospitales y laboratorios cerca de ti en el mapa interactivo.' },
  'landing.feature2_title': { pt: 'Agendamento Online', en: 'Online Booking', fr: 'Réservation en Ligne', es: 'Citas Online' },
  'landing.feature2_desc': { pt: 'Marque consultas com especialistas e visualize a disponibilidade dos médicos em tempo real.', en: 'Book appointments with specialists and view doctor availability in real time.', fr: 'Prenez rendez-vous avec des spécialistes et consultez la disponibilité des médecins en temps réel.', es: 'Agenda citas con especialistas y consulta la disponibilidad de los médicos en tiempo real.' },
  'landing.feature3_title': { pt: 'Gestão de Doenças Crónicas', en: 'Chronic Disease Management', fr: 'Gestion des Maladies Chroniques', es: 'Gestión de Enfermedades Crónicas' },
  'landing.feature3_desc': { pt: 'Registe as suas condições crónicas e receba acompanhamento personalizado com prescrições e lembretes.', en: 'Register your chronic conditions and receive personalized follow-up with prescriptions and reminders.', fr: 'Enregistrez vos conditions chroniques et recevez un suivi personnalisé avec prescriptions et rappels.', es: 'Registra tus condiciones crónicas y recibe seguimiento personalizado con recetas y recordatorios.' },

  'landing.cta_title': { pt: 'Comece a cuidar da sua saúde hoje', en: 'Start taking care of your health today', fr: 'Commencez à prendre soin de votre santé aujourd\'hui', es: 'Empieza a cuidar tu salud hoy' },
  'landing.cta_desc': { pt: 'Triagem inteligente, gestão de doenças crónicas, agendamento de consultas e prescrições digitais — tudo gratuito para começar.', en: 'Intelligent triage, chronic disease management, appointment scheduling and digital prescriptions — all free to get started.', fr: 'Triage intelligent, gestion des maladies chroniques, prise de rendez-vous et prescriptions numériques — tout gratuit pour commencer.', es: 'Triaje inteligente, gestión de enfermedades crónicas, programación de citas y recetas digitales — todo gratis para empezar.' },
  'landing.create_free': { pt: 'Criar Conta Grátis', en: 'Create Free Account', fr: 'Créer un Compte Gratuit', es: 'Crear Cuenta Gratis' },
  'landing.have_account': { pt: 'Já tenho conta', en: 'I have an account', fr: 'J\'ai un compte', es: 'Ya tengo cuenta' },

  /* ── Landing — Specialties Strip ── */
  'landing.specialties_title': { pt: 'Especialidades Disponíveis', en: 'Available Specialties', fr: 'Spécialités Disponibles', es: 'Especialidades Disponibles' },
  'landing.specialties_subtitle': { pt: 'Aceda a especialistas de diversas áreas através da plataforma', en: 'Access specialists from various fields through the platform', fr: 'Accédez à des spécialistes de différents domaines via la plateforme', es: 'Accede a especialistas de diversas áreas a través de la plataforma' },
  'landing.spec_cardiology': { pt: 'Cardiologia', en: 'Cardiology', fr: 'Cardiologie', es: 'Cardiología' },
  'landing.spec_endocrinology': { pt: 'Medicina Interna', en: 'Internal Medicine', fr: 'Médecine Interne', es: 'Medicina Interna' },
  'landing.spec_pulmonology': { pt: 'Infecciologia', en: 'Infectious Diseases', fr: 'Infectiologie', es: 'Infectología' },
  'landing.spec_dermatology': { pt: 'Hematologia', en: 'Hematology', fr: 'Hématologie', es: 'Hematología' },
  'landing.spec_neurology': { pt: 'Pneumologia', en: 'Pulmonology', fr: 'Pneumologie', es: 'Neumología' },
  'landing.spec_orthopedics': { pt: 'Gastroenterologia', en: 'Gastroenterology', fr: 'Gastroentérologie', es: 'Gastroenterología' },
  'landing.spec_psychiatry': { pt: 'Nefrologia', en: 'Nephrology', fr: 'Néphrologie', es: 'Nefrología' },
  'landing.spec_general': { pt: 'Oncologia', en: 'Oncology', fr: 'Oncologie', es: 'Oncología' },
  'landing.spec_more': { pt: '+12 especialidades', en: '+12 specialties', fr: '+12 spécialités', es: '+12 especialidades' },

  /* ── Landing — Chronic Diseases Banner ── */
  'landing.chronic_title': { pt: 'Gestão de Doenças Crónicas', en: 'Chronic Disease Management', fr: 'Gestion des Maladies Chroniques', es: 'Gestión de Enfermedades Crónicas' },
  'landing.chronic_subtitle': { pt: 'Acompanhamento contínuo e personalizado para cada condição', en: 'Continuous and personalized follow-up for each condition', fr: 'Suivi continu et personnalisé pour chaque condition', es: 'Seguimiento continuo y personalizado para cada condición' },
  'landing.chronic_diabetes': { pt: 'Diabetes', en: 'Diabetes', fr: 'Diabète', es: 'Diabetes' },
  'landing.chronic_diabetes_desc': { pt: 'Monitorização de glicemia, prescrições de insulina e acompanhamento com endocrinologia.', en: 'Blood sugar monitoring, insulin prescriptions and endocrinology follow-up.', fr: 'Surveillance de la glycémie, prescriptions d\'insuline et suivi en endocrinologie.', es: 'Monitorización de glucemia, recetas de insulina y seguimiento con endocrinología.' },
  'landing.chronic_hypertension': { pt: 'Hipertensão', en: 'Hypertension', fr: 'Hypertension', es: 'Hipertensión' },
  'landing.chronic_hypertension_desc': { pt: 'Registo de tensão arterial, ajuste de medicação e acompanhamento cardiológico.', en: 'Blood pressure tracking, medication adjustments and cardiology follow-up.', fr: 'Suivi de la tension artérielle, ajustement des médicaments et suivi cardiologique.', es: 'Registro de presión arterial, ajuste de medicación y seguimiento cardiológico.' },
  'landing.chronic_asthma': { pt: 'Asma & DPOC', en: 'Asthma & COPD', fr: 'Asthme & BPCO', es: 'Asma y EPOC' },
  'landing.chronic_asthma_desc': { pt: 'Planos de ação personalizados, prescrição de inaladores e teleconsulta com pneumologia.', en: 'Personalized action plans, inhaler prescriptions and pulmonology teleconsultation.', fr: 'Plans d\'action personnalisés, prescriptions d\'inhalateurs et téléconsultation en pneumologie.', es: 'Planes de acción personalizados, recetas de inhaladores y teleconsulta con neumología.' },
  'landing.chronic_mental': { pt: 'Epilepsia', en: 'Epilepsy', fr: 'Épilepsie', es: 'Epilepsia' },
  'landing.chronic_mental_desc': { pt: 'Gestão de crises, prescrição de antiepilépticos e acompanhamento neurológico regular.', en: 'Crisis management, antiepileptic prescriptions and regular neurological follow-up.', fr: 'Gestion des crises, prescription d\'antiépileptiques et suivi neurologique régulier.', es: 'Gestión de crisis, receta de antiepilépticos y seguimiento neurológico regular.' },

  /* ═══════════════════════════════════════════════════════════
     ABOUT PAGE (Sobre) — story, team, mission, timeline
     ═══════════════════════════════════════════════════════════ */
  'about.badge': { pt: 'A Nossa História', en: 'Our Story', fr: 'Notre Histoire', es: 'Nuestra Historia' },
  'about.hero_title1': { pt: 'Quem', en: 'Who', fr: 'Qui', es: 'Quiénes' },
  'about.hero_title2': { pt: 'Somos Nós', en: 'We Are', fr: 'Sommes-Nous', es: 'Somos' },
  'about.hero_desc': {
    pt: 'Nascemos da convicção de que a tecnologia pode eliminar barreiras no acesso à saúde. Ligamos pacientes a especialistas com segurança, rapidez e humanidade.',
    en: 'We were born from the conviction that technology can eliminate barriers in healthcare access. We connect patients to specialists with safety, speed and humanity.',
    fr: 'Nous sommes nés de la conviction que la technologie peut éliminer les barrières dans l\'accès aux soins. Nous connectons les patients aux spécialistes avec sécurité, rapidité et humanité.',
    es: 'Nacimos con la convicción de que la tecnología puede eliminar barreras en el acceso a la salud. Conectamos pacientes con especialistas con seguridad, rapidez y humanidad.',
  },
  'about.mission': { pt: 'A Nossa Missão', en: 'Our Mission', fr: 'Notre Mission', es: 'Nuestra Misión' },
  'about.mission_desc': {
    pt: 'Democratizar o acesso a especialidades médicas e à gestão de doenças crónicas através de prescrições digitais, triagem inteligente, agendamento online e um mapa de clínicas e hospitais.',
    en: 'Democratize access to medical specialties and chronic disease management through digital prescriptions, intelligent triage, online booking and a clinic and hospital map.',
    fr: 'Démocratiser l\'accès aux spécialités médicales et à la gestion des maladies chroniques grâce aux prescriptions numériques, au triage intelligent, à la réservation en ligne et à une carte des cliniques et hôpitaux.',
    es: 'Democratizar el acceso a especialidades médicas y la gestión de enfermedades crónicas mediante recetas digitales, triaje inteligente, citas online y un mapa de clínicas y hospitales.',
  },
  'about.vision': { pt: 'A Nossa Visão', en: 'Our Vision', fr: 'Notre Vision', es: 'Nuestra Visión' },
  'about.vision_desc': {
    pt: 'Ser a plataforma de referência para a saúde digital — com mapa interativo de clínicas e hospitais, agendamento de consultas, gestão de doenças crónicas e prescrições digitais, servindo pacientes e profissionais de saúde de forma integrada.',
    en: 'To be the leading digital health platform — with an interactive clinic and hospital map, appointment scheduling, chronic disease management and digital prescriptions, serving patients and healthcare professionals in an integrated way.',
    fr: 'Être la plateforme de référence pour la santé numérique — avec une carte interactive des cliniques et hôpitaux, prise de rendez-vous, gestion des maladies chroniques et prescriptions numériques, au service des patients et des professionnels de santé de manière intégrée.',
    es: 'Ser la plataforma de referencia en salud digital — con mapa interactivo de clínicas y hospitales, programación de citas, gestión de enfermedades crónicas y recetas digitales, sirviendo a pacientes y profesionales de salud de forma integrada.',
  },

  'about.timeline_title': { pt: 'A Nossa Visão de Progresso', en: 'Our Progress Vision', fr: 'Notre Vision de Progrès', es: 'Nuestra Visión de Progreso' },
  'about.timeline_subtitle': { pt: 'Etapas que planeamos alcançar', en: 'Milestones we plan to achieve', fr: 'Étapes que nous prévoyons d\'atteindre', es: 'Hitos que planeamos alcanzar' },
  'about.timeline_2024_q1': { pt: 'Fundação da Health Platform. Motor de triagem v1 e primeiros protótipos da plataforma.', en: 'Health Platform founded. Triage engine v1 and first platform prototypes.', fr: 'Fondation de Health Platform. Moteur de triage v1 et premiers prototypes de la plateforme.', es: 'Fundación de Health Platform. Motor de triaje v1 y primeros prototipos de la plataforma.' },
  'about.timeline_2024_q3': { pt: 'Lançamento da teleconsulta e integração com clínicas parceiras. Abertura a múltiplas especialidades.', en: 'Teleconsultation launch and integration with partner clinics. Opening to multiple specialties.', fr: 'Lancement de la téléconsultation et intégration avec des cliniques partenaires. Ouverture à plusieurs spécialités.', es: 'Lanzamiento de teleconsulta e integración con clínicas asociadas. Apertura a múltiples especialidades.' },
  'about.timeline_2025_q1': { pt: 'Prescrições digitais. Programas de acompanhamento de doenças crónicas. Mapa interativo de clínicas e hospitais.', en: 'Digital prescriptions. Chronic disease follow-up programs. Interactive clinic and hospital map.', fr: 'Prescriptions numériques. Programmes de suivi des maladies chroniques. Carte interactive des cliniques et hôpitaux.', es: 'Recetas digitales. Programas de seguimiento de enfermedades crónicas. Mapa interactivo de clínicas y hospitales.' },
  'about.timeline_2025_q4': { pt: 'IA de triagem v2. Agendamento online de consultas. Expansão da rede de especialistas e hospitais parceiros.', en: 'Triage AI v2. Online appointment scheduling. Expansion of specialist network and partner hospitals.', fr: 'IA de triage v2. Prise de rendez-vous en ligne. Expansion du réseau de spécialistes et hôpitaux partenaires.', es: 'IA de triaje v2. Programación online de citas. Expansión de la red de especialistas y hospitales asociados.' },

  'about.team_title': { pt: 'A Equipa', en: 'The Team', fr: 'L\'Équipe', es: 'El Equipo' },
  'about.team_subtitle': { pt: 'Pessoas apaixonadas por saúde e tecnologia', en: 'People passionate about health and technology', fr: 'Des personnes passionnées par la santé et la technologie', es: 'Personas apasionadas por la salud y la tecnología' },
  'about.team_clinical': { pt: 'Conselho Clínico & Especialidades', en: 'Clinical Board & Specialties', fr: 'Conseil Clinique & Spécialités', es: 'Consejo Clínico y Especialidades' },
  'about.team_clinical_desc': { pt: 'Especialistas médicos que validam protocolos clínicos, supervisionam programas de acompanhamento de doenças crónicas e garantem a qualidade das prescrições digitais.', en: 'Medical specialists who validate clinical protocols, supervise chronic disease follow-up programs and ensure digital prescription quality.', fr: 'Spécialistes médicaux qui valident les protocoles cliniques, supervisent les programmes de suivi des maladies chroniques et assurent la qualité des prescriptions numériques.', es: 'Especialistas médicos que validan protocolos clínicos, supervisan programas de seguimiento de enfermedades crónicas y garantizan la calidad de las recetas digitales.' },
  'about.team_ops': { pt: 'Operações & Suporte', en: 'Operations & Support', fr: 'Opérations & Support', es: 'Operaciones y Soporte' },
  'about.team_ops_desc': { pt: 'Equipa dedicada ao suporte de pacientes e médicos, disponível para garantir a melhor experiência possível.', en: 'Team dedicated to patient and doctor support, available to ensure the best possible experience.', fr: 'Équipe dédiée au support des patients et médecins, disponible pour assurer la meilleure expérience possible.', es: 'Equipo dedicado al soporte de pacientes y médicos, disponible para garantizar la mejor experiencia posible.' },

  'about.cta_title': { pt: 'Quer fazer parte desta missão?', en: 'Want to be part of this mission?', fr: 'Vous voulez faire partie de cette mission ?', es: '¿Quieres formar parte de esta misión?' },
  'about.cta_desc': { pt: 'Junte-se como paciente, médico ou parceiro. Estamos a construir o futuro da saúde digital.', en: 'Join as a patient, doctor or partner. We are building the future of digital health.', fr: 'Rejoignez-nous en tant que patient, médecin ou partenaire. Nous construisons le futur de la santé numérique.', es: 'Únete como paciente, médico o socio. Estamos construyendo el futuro de la salud digital.' },
  'about.create_account': { pt: 'Criar Conta', en: 'Create Account', fr: 'Créer un Compte', es: 'Crear Cuenta' },

  /* ═══════════════════════════════════════════════════════════
     SERVICES PAGE (Serviços) — detailed service descriptions
     ═══════════════════════════════════════════════════════════ */
  'services.hero_title': { pt: 'Especialidades, Prescrições & Saúde Digital', en: 'Specialties, Prescriptions & Digital Health', fr: 'Spécialités, Prescriptions & Santé Numérique', es: 'Especialidades, Recetas y Salud Digital' },
  'services.hero_desc': {
    pt: 'Múltiplas especialidades médicas, prescrições digitais, programas de acompanhamento de doenças crónicas e mapa interativo de clínicas e hospitais — tudo na mesma plataforma.',
    en: 'Multiple medical specialties, digital prescriptions, chronic disease follow-up programs and an interactive clinic and hospital map — all on one platform.',
    fr: 'Multiples spécialités médicales, prescriptions numériques, programmes de suivi des maladies chroniques et carte interactive des cliniques et hôpitaux — le tout sur une seule plateforme.',
    es: 'Múltiples especialidades médicas, recetas digitales, programas de seguimiento de enfermedades crónicas y mapa interactivo de clínicas y hospitales — todo en una sola plataforma.',
  },

  'services.triage_title': { pt: 'Triagem Inteligente', en: 'Intelligent Triage', fr: 'Triage Intelligent', es: 'Triaje Inteligente' },
  'services.triage_desc': {
    pt: 'Sistema de avaliação baseado em sintomas com classificação de risco automática (verde, amarelo, laranja, vermelho). Protocolos validados por médicos, resultados em menos de 3 minutos.',
    en: 'Symptom-based assessment system with automatic risk classification (green, yellow, orange, red). Doctor-validated protocols, results in under 3 minutes.',
    fr: 'Système d\'évaluation basé sur les symptômes avec classification automatique des risques (vert, jaune, orange, rouge). Protocoles validés par des médecins, résultats en moins de 3 minutes.',
    es: 'Sistema de evaluación basado en síntomas con clasificación automática de riesgo (verde, amarillo, naranja, rojo). Protocolos validados por médicos, resultados en menos de 3 minutos.',
  },
  'services.teleconsult_title': { pt: 'Teleconsulta Médica', en: 'Medical Teleconsultation', fr: 'Téléconsultation Médicale', es: 'Teleconsulta Médica' },
  'services.teleconsult_desc': {
    pt: 'Consultas online com médicos verificados. Agendamento flexível, histórico clínico integrado e prescrição digital. Disponível 7 dias por semana.',
    en: 'Online consultations with verified doctors. Flexible scheduling, integrated clinical history and digital prescriptions. Available 7 days a week.',
    fr: 'Consultations en ligne avec des médecins vérifiés. Planification flexible, historique clinique intégré et prescription numérique. Disponible 7 jours sur 7.',
    es: 'Consultas online con médicos verificados. Programación flexible, historial clínico integrado y receta digital. Disponible 7 días a la semana.',
  },
  'services.prescriptions_title': { pt: 'Prescrições Digitais', en: 'Digital Prescriptions', fr: 'Prescriptions Numériques', es: 'Recetas Digitales' },
  'services.prescriptions_desc': {
    pt: 'Receitas médicas digitais enviadas à farmácia da sua escolha. Renovação automática para doenças crónicas, alertas de interações medicamentosas e historial completo de prescrições acessível 24/7.',
    en: 'Digital prescriptions sent to your chosen pharmacy. Automatic renewal for chronic diseases, drug interaction alerts and complete prescription history accessible 24/7.',
    fr: 'Ordonnances numériques envoyées à la pharmacie de votre choix. Renouvellement automatique pour les maladies chroniques, alertes d\'interactions médicamenteuses et historique complet des prescriptions accessible 24/7.',
    es: 'Recetas médicas digitales enviadas a la farmacia de tu elección. Renovación automática para enfermedades crónicas, alertas de interacciones medicamentosas e historial completo de recetas accesible 24/7.',
  },
  'services.followup_title': { pt: 'Doenças Crónicas', en: 'Chronic Diseases', fr: 'Maladies Chroniques', es: 'Enfermedades Crónicas' },
  'services.followup_desc': {
    pt: 'Programas de acompanhamento para diabetes, hipertensão, asma, DPOC, epilepsia, drepanocitose, VIH/SIDA, insuficiência renal e outras condições crónicas. Monitorização de sinais vitais, ajuste de medicação e consultas regulares com especialistas.',
    en: 'Follow-up programs for diabetes, hypertension, asthma, COPD, epilepsy, sickle cell disease, HIV/AIDS, kidney failure and other chronic conditions. Vital signs monitoring, medication adjustments and regular specialist consultations.',
    fr: 'Programmes de suivi pour le diabète, l\'hypertension, l\'asthme, la BPCO, l\'épilepsie, la drépanocytose, le VIH/SIDA, l\'insuffisance rénale et d\'autres maladies chroniques. Surveillance des signes vitaux, ajustement des médicaments et consultations régulières avec des spécialistes.',
    es: 'Programas de seguimiento para diabetes, hipertensión, asma, EPOC, epilepsia, drepanocitosis, VIH/SIDA, insuficiencia renal y otras condiciones crónicas. Monitorización de signos vitales, ajuste de medicación y consultas regulares con especialistas.',
  },
  'services.corporate_title': { pt: 'Saúde Corporativa', en: 'Corporate Health', fr: 'Santé d\'Entreprise', es: 'Salud Corporativa' },
  'services.corporate_desc': {
    pt: 'Painel de saúde ocupacional para empresas. Gestão de colaboradores, relatórios de absentismo, campanhas de vacinação e check-ups periódicos — tudo centralizado.',
    en: 'Occupational health dashboard for companies. Employee management, absenteeism reports, vaccination campaigns and periodic check-ups — all centralized.',
    fr: 'Tableau de bord de santé au travail pour les entreprises. Gestion des employés, rapports d\'absentéisme, campagnes de vaccination et bilans périodiques — le tout centralisé.',
    es: 'Panel de salud ocupacional para empresas. Gestión de empleados, informes de absentismo, campañas de vacunación y chequeos periódicos — todo centralizado.',
  },
  'services.emergency_title': { pt: 'Especialidades Médicas', en: 'Medical Specialties', fr: 'Spécialités Médicales', es: 'Especialidades Médicas' },
  'services.emergency_desc': {
    pt: 'Acesso a múltiplas especialidades médicas: cardiologia, medicina interna, neurologia, pneumologia, gastroenterologia, nefrologia, oncologia, dermatologia, endocrinologia, psiquiatria e mais. Ligação direta com clínicas e hospitais parceiros.',
    en: 'Access to multiple medical specialties: cardiology, internal medicine, neurology, pulmonology, gastroenterology, nephrology, oncology, dermatology, endocrinology, psychiatry and more. Direct connection with partner clinics and hospitals.',
    fr: 'Accès à de multiples spécialités médicales : cardiologie, médecine interne, neurologie, pneumologie, gastroentérologie, néphrologie, oncologie, dermatologie, endocrinologie, psychiatrie et plus. Connexion directe avec les cliniques et hôpitaux partenaires.',
    es: 'Acceso a múltiples especialidades médicas: cardiología, medicina interna, neurología, neumología, gastroenterología, nefrología, oncología, dermatología, endocrinología, psiquiatría y más. Conexión directa con clínicas y hospitales asociados.',
  },

  'services.for_patients': { pt: 'Para Pacientes', en: 'For Patients', fr: 'Pour les Patients', es: 'Para Pacientes' },
  'services.for_patients_desc': { pt: 'Gestão de doenças crónicas, prescrições digitais, acesso a múltiplas especialidades, mapa de clínicas e hospitais e teleconsulta — tudo num só lugar.', en: 'Chronic disease management, digital prescriptions, access to multiple specialties, clinic and hospital map and teleconsultation — all in one place.', fr: 'Gestion des maladies chroniques, prescriptions numériques, accès à plusieurs spécialités, carte des cliniques et hôpitaux et téléconsultation — tout en un seul endroit.', es: 'Gestión de enfermedades crónicas, recetas digitales, acceso a múltiples especialidades, mapa de clínicas y hospitales y teleconsulta — todo en un solo lugar.' },
  'services.for_doctors': { pt: 'Para Médicos', en: 'For Doctors', fr: 'Pour les Médecins', es: 'Para Médicos' },
  'services.for_doctors_desc': { pt: 'Prescrição digital integrada, painel de doentes crónicos, fila por especialidade e histórico clínico completo num só lugar.', en: 'Integrated digital prescribing, chronic patient dashboard, specialty-based queue and complete clinical history in one place.', fr: 'Prescription numérique intégrée, tableau de bord des patients chroniques, file par spécialité et historique clinique complet en un seul endroit.', es: 'Receta digital integrada, panel de pacientes crónicos, cola por especialidad e historial clínico completo en un solo lugar.' },
  'services.for_companies': { pt: 'Para Empresas', en: 'For Companies', fr: 'Pour les Entreprises', es: 'Para Empresas' },
  'services.for_companies_desc': { pt: 'Programas de prevenção de doenças crónicas, check-ups por especialidade, prescrições corporativas e relatórios de saúde ocupacional.', en: 'Chronic disease prevention programs, specialty check-ups, corporate prescriptions and occupational health reports.', fr: 'Programmes de prévention des maladies chroniques, bilans par spécialité, prescriptions corporate et rapports de santé au travail.', es: 'Programas de prevención de enfermedades crónicas, chequeos por especialidad, recetas corporativas e informes de salud ocupacional.' },

  'services.faq_title': { pt: 'Perguntas Frequentes', en: 'Frequently Asked Questions', fr: 'Questions Fréquentes', es: 'Preguntas Frecuentes' },
  'services.faq1_q': { pt: 'As prescrições digitais têm validade legal?', en: 'Are digital prescriptions legally valid?', fr: 'Les prescriptions numériques sont-elles légalement valides ?', es: '¿Las recetas digitales tienen validez legal?' },
  'services.faq1_a': { pt: 'Sim. As prescrições são emitidas por médicos registados e têm a mesma validade legal que as prescrições em papel. São enviadas directamente à farmácia da sua escolha.', en: 'Yes. Prescriptions are issued by registered doctors and have the same legal validity as paper prescriptions. They are sent directly to your pharmacy of choice.', fr: 'Oui. Les prescriptions sont émises par des médecins inscrits et ont la même validité légale que les prescriptions papier. Elles sont envoyées directement à la pharmacie de votre choix.', es: 'Sí. Las recetas son emitidas por médicos registrados y tienen la misma validez legal que las recetas en papel. Se envían directamente a la farmacia de tu elección.' },
  'services.faq2_q': { pt: 'Que doenças crónicas são acompanhadas?', en: 'Which chronic diseases are covered?', fr: 'Quelles maladies chroniques sont suivies ?', es: '¿Qué enfermedades crónicas se atienden?' },
  'services.faq2_a': { pt: 'Acompanhamos diabetes (tipo 1 e 2), hipertensão arterial, asma, DPOC, epilepsia, drepanocitose, VIH/SIDA, insuficiência renal, doenças cardíacas, artrite reumatóide e muitas mais. Cada programa inclui monitorização, prescrições e consultas regulares com especialistas.', en: 'We cover type 1 and 2 diabetes, arterial hypertension, asthma, COPD, epilepsy, sickle cell disease, HIV/AIDS, kidney failure, heart disease, rheumatoid arthritis and many more. Each program includes monitoring, prescriptions and regular specialist consultations.', fr: 'Nous couvrons le diabète (type 1 et 2), l\'hypertension artérielle, l\'asthme, la BPCO, l\'épilepsie, la drépanocytose, le VIH/SIDA, l\'insuffisance rénale, les maladies cardiaques, la polyarthrite rhumatoïde et bien d\'autres. Chaque programme comprend la surveillance, les prescriptions et les consultations régulières avec des spécialistes.', es: 'Atendemos diabetes tipo 1 y 2, hipertensión arterial, asma, EPOC, epilepsia, drepanocitosis, VIH/SIDA, insuficiencia renal, enfermedades cardíacas, artritis reumatoide y muchas más. Cada programa incluye monitorización, recetas y consultas regulares con especialistas.' },
  'services.faq3_q': { pt: 'Que especialidades médicas estão disponíveis?', en: 'Which medical specialties are available?', fr: 'Quelles spécialités médicales sont disponibles ?', es: '¿Qué especialidades médicas están disponibles?' },
  'services.faq3_a': { pt: 'Disponibilizamos múltiplas especialidades: cardiologia, medicina interna, neurologia, pneumologia, gastroenterologia, nefrologia, oncologia, dermatologia, endocrinologia, psiquiatria, geriatria e outras. A rede de clínicas e hospitais parceiros está em constante crescimento.', en: 'We offer multiple specialties: cardiology, internal medicine, neurology, pulmonology, gastroenterology, nephrology, oncology, dermatology, endocrinology, psychiatry, geriatrics and others. Our partner clinic and hospital network is constantly growing.', fr: 'Nous proposons de multiples spécialités : cardiologie, médecine interne, neurologie, pneumologie, gastroentérologie, néphrologie, oncologie, dermatologie, endocrinologie, psychiatrie, gériatrie et autres. Notre réseau de cliniques et hôpitaux partenaires est en constante croissance.', es: 'Ofrecemos múltiples especialidades: cardiología, medicina interna, neurología, neumología, gastroenterología, nefrología, oncología, dermatología, endocrinología, psiquiatría, geriatría y otras. Nuestra red de clínicas y hospitales asociados está en constante crecimiento.' },
  'services.faq4_q': { pt: 'Posso renovar prescrições de doenças crónicas automaticamente?', en: 'Can I automatically renew chronic disease prescriptions?', fr: 'Puis-je renouveler automatiquement les prescriptions de maladies chroniques ?', es: '¿Puedo renovar recetas de enfermedades crónicas automáticamente?' },
  'services.faq4_a': { pt: 'Sim. As prescrições de medicação crónica podem ser renovadas automaticamente após validação pelo seu médico. Recebe notificações antes do fim de cada ciclo.', en: 'Yes. Chronic medication prescriptions can be automatically renewed after validation by your doctor. You receive notifications before each cycle ends.', fr: 'Oui. Les prescriptions de médicaments chroniques peuvent être renouvelées automatiquement après validation par votre médecin. Vous recevez des notifications avant la fin de chaque cycle.', es: 'Sí. Las recetas de medicación crónica pueden renovarse automáticamente tras la validación de tu médico. Recibes notificaciones antes del fin de cada ciclo.' },
  'services.faq5_q': { pt: 'Posso usar a plataforma para a minha empresa?', en: 'Can I use the platform for my company?', fr: 'Puis-je utiliser la plateforme pour mon entreprise ?', es: '¿Puedo usar la plataforma para mi empresa?' },
  'services.faq5_a': { pt: 'Sim! A plataforma oferece gestão de doenças crónicas dos colaboradores, prescrições corporativas, consultas com todas as especialidades e relatórios de saúde ocupacional.', en: 'Yes! The platform offers employee chronic disease management, corporate prescriptions, consultations across all specialties and occupational health reports.', fr: 'Oui ! La plateforme offre la gestion des maladies chroniques des employés, les prescriptions corporate, les consultations dans toutes les spécialités et les rapports de santé au travail.', es: '¡Sí! La plataforma ofrece gestión de enfermedades crónicas de los empleados, recetas corporativas, consultas con todas las especialidades e informes de salud ocupacional.' },

  /* ═══════════════════════════════════════════════════════════
     TRIAGE — start flow additions (age group + category)
     ═══════════════════════════════════════════════════════════ */
  'triage.age_group': { pt: 'Para quem é a triagem?', en: 'Who is the triage for?', fr: 'Pour qui est le triage ?', es: '¿Para quién es el triaje?' },
  'triage.age_adult': { pt: 'Adulto', en: 'Adult', fr: 'Adulte', es: 'Adulto' },
  'triage.age_child': { pt: 'Criança', en: 'Child', fr: 'Enfant', es: 'Niño/a' },
  'triage.answered_by_parent': { pt: 'Estou a responder como pai/mãe ou responsável', en: 'I am answering as a parent/guardian', fr: 'Je réponds en tant que parent/tuteur', es: 'Estoy respondiendo como padre/madre o tutor' },

  'triage.category': { pt: 'Categoria', en: 'Category', fr: 'Catégorie', es: 'Categoría' },
  'triage.cat_general': { pt: 'Geral / Não sei', en: 'General / Not sure', fr: 'Général / Je ne sais pas', es: 'General / No sé' },
  'triage.cat_respiratory': { pt: 'Respiração (tosse, falta de ar)', en: 'Breathing (cough, shortness of breath)', fr: 'Respiration (toux, essoufflement)', es: 'Respiración (tos, falta de aire)' },
  'triage.cat_cardiac': { pt: 'Coração / Peito', en: 'Heart / Chest', fr: 'Cœur / Poitrine', es: 'Corazón / Pecho' },
  'triage.cat_neuro': { pt: 'Neurológico (cabeça, tonturas, convulsões)', en: 'Neurologic (head, dizziness, seizures)', fr: 'Neurologique (tête, vertiges, crises)', es: 'Neurológico (cabeza, mareos, convulsiones)' },
  'triage.cat_gi': { pt: 'Gastrointestinal (dor abdominal, vómitos, diarreia)', en: 'Gastrointestinal (abdominal pain, vomiting, diarrhea)', fr: 'Gastro-intestinal (douleur abdominale, vomissements, diarrhée)', es: 'Gastrointestinal (dolor abdominal, vómitos, diarrea)' },
  'triage.cat_urinary': { pt: 'Urinário / Genital', en: 'Urinary / Genital', fr: 'Urinaire / Génital', es: 'Urinario / Genital' },
  'triage.cat_skin': { pt: 'Pele (alergia, erupção)', en: 'Skin (allergy, rash)', fr: 'Peau (allergie, éruption)', es: 'Piel (alergia, erupción)' },
  'triage.cat_injury': { pt: 'Trauma / Lesão', en: 'Trauma / Injury', fr: 'Traumatisme / Blessure', es: 'Trauma / Lesión' },
  'triage.cat_mental': { pt: 'Saúde mental', en: 'Mental health', fr: 'Santé mentale', es: 'Salud mental' },
  'triage.cat_womens': { pt: 'Saúde da mulher / Gravidez', en: "Women's health / Pregnancy", fr: 'Santé de la femme / Grossesse', es: 'Salud de la mujer / Embarazo' },
  'triage.cat_medication': { pt: 'Medicação (efeitos, dose, reação)', en: 'Medication (effects, dose, reaction)', fr: 'Médicaments (effets, dose, réaction)', es: 'Medicación (efectos, dosis, reacción)' },
  'triage.cat_chronic': { pt: 'Doença crónica (controlo, crise)', en: 'Chronic condition (control, flare)', fr: 'Maladie chronique (contrôle, crise)', es: 'Enfermedad crónica (control, crisis)' },

   'triage.summary': { pt: 'Resumo', en: 'Summary', fr: 'Résumé', es: 'Resumen' },

  /* ═══════════════════════════════════════════════════════════
     LOGIN PAGE
     ═══════════════════════════════════════════════════════════ */
  'login.title': { pt: 'Iniciar Sessão', en: 'Sign In', fr: 'Connexion', es: 'Iniciar Sesión' },
  'login.subtitle': { pt: 'Aceda ao portal KAYA', en: 'Access the KAYA portal', fr: 'Accédez au portail KAYA', es: 'Accede al portal KAYA' },
  'login.email': { pt: 'Email', en: 'Email', fr: 'Email', es: 'Email' },
  'login.password': { pt: 'Palavra-passe', en: 'Password', fr: 'Mot de passe', es: 'Contraseña' },
  'login.submit': { pt: 'Iniciar Sessão', en: 'Sign In', fr: 'Se connecter', es: 'Iniciar Sesión' },
  'login.loading': { pt: 'A entrar…', en: 'Signing in…', fr: 'Connexion…', es: 'Entrando…' },
  'login.google': { pt: 'Entrar com Google', en: 'Sign in with Google', fr: 'Se connecter avec Google', es: 'Entrar con Google' },
  'login.microsoft': { pt: 'Entrar com Microsoft', en: 'Sign in with Microsoft', fr: 'Se connecter avec Microsoft', es: 'Entrar con Microsoft' },
  'login.forgot': { pt: 'Esqueceu a palavra-passe?', en: 'Forgot password?', fr: 'Mot de passe oublié ?', es: '¿Olvidaste la contraseña?' },
  'login.no_account': { pt: 'Não tem conta?', en: "Don't have an account?", fr: "Vous n'avez pas de compte ?", es: '¿No tienes cuenta?' },
  'login.create_account': { pt: 'Criar conta', en: 'Create account', fr: 'Créer un compte', es: 'Crear cuenta' },
  'login.invalid': { pt: 'Credenciais inválidas.', en: 'Invalid credentials.', fr: 'Identifiants invalides.', es: 'Credenciales inválidas.' },
  'login.access_hint': { pt: 'Aceda com as suas credenciais.', en: 'Access with your credentials.', fr: 'Accédez avec vos identifiants.', es: 'Accede con tus credenciales.' },
  'login.back_site': { pt: '← Voltar ao site', en: '← Back to site', fr: '← Retour au site', es: '← Volver al sitio' },
  'login.forgot_title': { pt: 'Recuperar Palavra-passe', en: 'Recover Password', fr: 'Récupérer le mot de passe', es: 'Recuperar Contraseña' },
  'login.forgot_desc': { pt: 'Insira o seu email e enviaremos instruções de recuperação.', en: 'Enter your email and we will send recovery instructions.', fr: 'Entrez votre email et nous vous enverrons des instructions de récupération.', es: 'Ingresa tu email y te enviaremos instrucciones de recuperación.' },
  'login.forgot_submit': { pt: 'Enviar', en: 'Send', fr: 'Envoyer', es: 'Enviar' },
  'login.forgot_msg': { pt: 'Se o email existir, receberá instruções de recuperação.', en: 'If the email exists, you will receive recovery instructions.', fr: 'Si l\'email existe, vous recevrez des instructions de récupération.', es: 'Si el email existe, recibirás instrucciones de recuperación.' },

  /* ═══════════════════════════════════════════════════════════
     REGISTER PAGE
     ═══════════════════════════════════════════════════════════ */
  'register.title': { pt: 'Criar Conta', en: 'Create Account', fr: 'Créer un Compte', es: 'Crear Cuenta' },
  'register.subtitle': { pt: 'Registe-se na Health Platform', en: 'Register on Health Platform', fr: 'Inscrivez-vous sur Health Platform', es: 'Regístrate en Health Platform' },
  'register.full_name': { pt: 'Nome Completo', en: 'Full Name', fr: 'Nom Complet', es: 'Nombre Completo' },
  'register.email': { pt: 'Email', en: 'Email', fr: 'Email', es: 'Email' },
  'register.password': { pt: 'Palavra-passe', en: 'Password', fr: 'Mot de passe', es: 'Contraseña' },
  'register.password_placeholder': { pt: 'Escolha uma palavra-passe', en: 'Choose a password', fr: 'Choisissez un mot de passe', es: 'Elige una contraseña' },
  'register.confirm_password': { pt: 'Confirmar Palavra-passe', en: 'Confirm Password', fr: 'Confirmer le mot de passe', es: 'Confirmar Contraseña' },
  'register.confirm_placeholder': { pt: 'Repetir palavra-passe', en: 'Repeat password', fr: 'Répéter le mot de passe', es: 'Repetir contraseña' },
  'register.sector': { pt: 'Área de Interesse', en: 'Area of Interest', fr: 'Domaine d\'Intérêt', es: 'Área de Interés' },
  'register.sector_select': { pt: 'Selecionar especialidade', en: 'Select specialty', fr: 'Sélectionner la spécialité', es: 'Seleccionar especialidad' },
  'register.sector_general': { pt: 'Clínica Geral', en: 'General Practice', fr: 'Médecine Générale', es: 'Medicina General' },
  'register.sector_cardiology': { pt: 'Cardiologia', en: 'Cardiology', fr: 'Cardiologie', es: 'Cardiología' },
  'register.sector_dermatology': { pt: 'Dermatologia', en: 'Dermatology', fr: 'Dermatologie', es: 'Dermatología' },
  'register.sector_pediatrics': { pt: 'Pediatria', en: 'Pediatrics', fr: 'Pédiatrie', es: 'Pediatría' },
  'register.sector_orthopedics': { pt: 'Ortopedia', en: 'Orthopedics', fr: 'Orthopédie', es: 'Ortopedia' },
  'register.sector_neurology': { pt: 'Neurologia', en: 'Neurology', fr: 'Neurologie', es: 'Neurología' },
  'register.submit': { pt: 'Criar Conta', en: 'Create Account', fr: 'Créer un Compte', es: 'Crear Cuenta' },
  'register.loading': { pt: 'A criar…', en: 'Creating…', fr: 'Création…', es: 'Creando…' },
  'register.cancel': { pt: 'Cancelar', en: 'Cancel', fr: 'Annuler', es: 'Cancelar' },
  'register.pw_mismatch': { pt: 'As palavras-passe não coincidem.', en: 'Passwords do not match.', fr: 'Les mots de passe ne correspondent pas.', es: 'Las contraseñas no coinciden.' },
  'register.pw_short': { pt: 'A palavra-passe deve ter pelo menos 6 caracteres.', en: 'Password must be at least 6 characters.', fr: 'Le mot de passe doit contenir au moins 6 caractères.', es: 'La contraseña debe tener al menos 6 caracteres.' },
  'register.error': { pt: 'Erro ao criar conta.', en: 'Error creating account.', fr: 'Erreur lors de la création du compte.', es: 'Error al crear la cuenta.' },
  'register.have_account': { pt: 'Já tem conta?', en: 'Already have an account?', fr: 'Vous avez déjà un compte ?', es: '¿Ya tienes cuenta?' },
  'register.sign_in': { pt: 'Iniciar sessão', en: 'Sign in', fr: 'Se connecter', es: 'Iniciar sesión' },
  'register.back_site': { pt: '← Voltar ao site', en: '← Back to site', fr: '← Retour au site', es: '← Volver al sitio' },

  /* ═══════════════════════════════════════════════════════════
     SIDEBAR
     ═══════════════════════════════════════════════════════════ */
  'sidebar.main': { pt: 'Principal', en: 'Main', fr: 'Principal', es: 'Principal' },
  'sidebar.overview': { pt: 'Visão Geral', en: 'Overview', fr: 'Aperçu', es: 'Visión General' },
  'sidebar.my_profile': { pt: 'Meu Perfil', en: 'My Profile', fr: 'Mon Profil', es: 'Mi Perfil' },
  'sidebar.triage': { pt: 'Triagem', en: 'Triage', fr: 'Triage', es: 'Triaje' },
  'sidebar.consultations': { pt: 'Consultas', en: 'Consultations', fr: 'Consultations', es: 'Consultas' },
  'sidebar.consents': { pt: 'Consentimentos', en: 'Consents', fr: 'Consentements', es: 'Consentimientos' },
  'sidebar.self_care': { pt: 'Autocuidado', en: 'Self-Care', fr: 'Auto-soins', es: 'Autocuidado' },
  'sidebar.doctor': { pt: 'Médico', en: 'Doctor', fr: 'Médecin', es: 'Médico' },
  'sidebar.doctor_profile': { pt: 'Perfil Médico', en: 'Doctor Profile', fr: 'Profil Médecin', es: 'Perfil Médico' },
  'sidebar.queue': { pt: 'Fila de Espera', en: 'Queue', fr: 'File d\'Attente', es: 'Cola de Espera' },
  'sidebar.admin': { pt: 'Administração', en: 'Administration', fr: 'Administration', es: 'Administración' },
  'sidebar.dashboard': { pt: 'Dashboard', en: 'Dashboard', fr: 'Tableau de Bord', es: 'Panel' },
  'sidebar.patients': { pt: 'Pacientes', en: 'Patients', fr: 'Patients', es: 'Pacientes' },
  'sidebar.verify_doctors': { pt: 'Verificar Médicos', en: 'Verify Doctors', fr: 'Vérifier Médecins', es: 'Verificar Médicos' },
  'sidebar.account': { pt: 'Conta', en: 'Account', fr: 'Compte', es: 'Cuenta' },
  'sidebar.settings': { pt: 'Definições', en: 'Settings', fr: 'Paramètres', es: 'Ajustes' },
  'sidebar.logout': { pt: 'Terminar Sessão', en: 'Sign Out', fr: 'Déconnexion', es: 'Cerrar Sesión' },
  'sidebar.role_admin': { pt: 'Administrador', en: 'Administrator', fr: 'Administrateur', es: 'Administrador' },
  'sidebar.role_doctor': { pt: 'Médico', en: 'Doctor', fr: 'Médecin', es: 'Médico' },
  'sidebar.role_patient': { pt: 'Paciente', en: 'Patient', fr: 'Patient', es: 'Paciente' },
  'sidebar.user_fallback': { pt: 'Utilizador', en: 'User', fr: 'Utilisateur', es: 'Usuario' },

  /* ═══════════════════════════════════════════════════════════
     TOPBAR (ProtectedRoute breadcrumbs)
     ═══════════════════════════════════════════════════════════ */
  'topbar.overview': { pt: 'Visão Geral', en: 'Overview', fr: 'Aperçu', es: 'Visión General' },
  'topbar.my_profile': { pt: 'Meu Perfil', en: 'My Profile', fr: 'Mon Profil', es: 'Mi Perfil' },
  'topbar.triage': { pt: 'Triagem', en: 'Triage', fr: 'Triage', es: 'Triaje' },
  'topbar.consultations': { pt: 'Consultas', en: 'Consultations', fr: 'Consultations', es: 'Consultas' },
  'topbar.self_care': { pt: 'Autocuidado', en: 'Self-Care', fr: 'Auto-soins', es: 'Autocuidado' },
  'topbar.consents': { pt: 'Consentimentos', en: 'Consents', fr: 'Consentements', es: 'Consentimientos' },
  'topbar.doctor_profile': { pt: 'Perfil Médico', en: 'Doctor Profile', fr: 'Profil Médecin', es: 'Perfil Médico' },
  'topbar.queue': { pt: 'Fila de Espera', en: 'Queue', fr: 'File d\'Attente', es: 'Cola de Espera' },
  'topbar.admin_dashboard': { pt: 'Dashboard Admin', en: 'Admin Dashboard', fr: 'Tableau de Bord Admin', es: 'Panel Admin' },
  'topbar.verify_doctors': { pt: 'Verificar Médicos', en: 'Verify Doctors', fr: 'Vérifier Médecins', es: 'Verificar Médicos' },
  'topbar.settings': { pt: 'Definições', en: 'Settings', fr: 'Paramètres', es: 'Ajustes' },

  /* ═══════════════════════════════════════════════════════════
     DASHBOARD PAGE
     ═══════════════════════════════════════════════════════════ */
  'dash.panel': { pt: 'Painel do Paciente', en: 'Patient Panel', fr: 'Panneau du Patient', es: 'Panel del Paciente' },
  'dash.hello': { pt: 'Olá,', en: 'Hello,', fr: 'Bonjour,', es: '¡Hola,' },
  'dash.subtitle': { pt: 'O seu assistente de saúde digital. Avalie sintomas, receba recomendações e marque consultas.', en: 'Your digital health assistant. Evaluate symptoms, receive recommendations and schedule consultations.', fr: 'Votre assistant de santé numérique. Évaluez les symptômes, recevez des recommandations et prenez rendez-vous.', es: 'Tu asistente de salud digital. Evalúa síntomas, recibe recomendaciones y programa consultas.' },
  'dash.urgent_title': { pt: '⚠️ Atenção Urgente', en: '⚠️ Urgent Attention', fr: '⚠️ Attention Urgente', es: '⚠️ Atención Urgente' },
  'dash.urgent_desc': {
    pt: 'Com base na sua triagem, recomendamos que procure atendimento de urgência imediatamente. Ligue 112 ou dirija-se ao serviço de urgência mais próximo.',
    en: 'Based on your triage, we recommend you seek emergency care immediately. Call 112 or go to the nearest emergency room.',
    fr: 'Selon votre triage, nous recommandons de chercher des soins d\'urgence immédiatement. Appelez le 112 ou rendez-vous aux urgences les plus proches.',
    es: 'Según tu triaje, recomendamos que busques atención de urgencias inmediatamente. Llama al 112 o dirígete a la sala de urgencias más cercana.',
  },
  'dash.current_state': { pt: 'Estado Atual', en: 'Current State', fr: 'État Actuel', es: 'Estado Actual' },
  'dash.no_triage_desc': { pt: 'Inicie uma triagem inteligente para avaliar os seus sintomas e receber uma recomendação personalizada.', en: 'Start an intelligent triage to evaluate your symptoms and receive a personalized recommendation.', fr: 'Commencez un triage intelligent pour évaluer vos symptômes et recevoir une recommandation personnalisée.', es: 'Inicia un triaje inteligente para evaluar tus síntomas y recibir una recomendación personalizada.' },
  'dash.triage_in_progress': { pt: 'Complete a sua triagem para receber a classificação de risco.', en: 'Complete your triage to receive the risk classification.', fr: 'Complétez votre triage pour recevoir la classification des risques.', es: 'Completa tu triaje para recibir la clasificación de riesgo.' },
  'dash.complaint': { pt: 'Queixa:', en: 'Complaint:', fr: 'Plainte :', es: 'Queja:' },
  'dash.risk': { pt: 'Risco', en: 'Risk', fr: 'Risque', es: 'Riesgo' },
  'dash.consultation_booked': { pt: 'A sua consulta está agendada. Aguarde o contacto do médico.', en: 'Your consultation is scheduled. Wait for the doctor\'s contact.', fr: 'Votre consultation est programmée. Attendez le contact du médecin.', es: 'Tu consulta está programada. Espera el contacto del médico.' },
  'dash.consultation_completed': { pt: 'Caso resolvido. Pode iniciar uma nova triagem se tiver novos sintomas.', en: 'Case resolved. You can start a new triage if you have new symptoms.', fr: 'Cas résolu. Vous pouvez commencer un nouveau triage si vous avez de nouveaux symptômes.', es: 'Caso resuelto. Puedes iniciar un nuevo triaje si tienes nuevos síntomas.' },
  'dash.last_risk': { pt: 'Último Risco', en: 'Last Risk', fr: 'Dernier Risque', es: 'Último Riesgo' },
  'dash.next_action': { pt: 'Próxima Ação', en: 'Next Action', fr: 'Prochaine Action', es: 'Próxima Acción' },
  'dash.whenever': { pt: 'Quando quiser', en: 'Whenever you want', fr: 'Quand vous voulez', es: 'Cuando quieras' },
  'dash.start_triage': { pt: 'Iniciar triagem', en: 'Start triage', fr: 'Commencer le triage', es: 'Iniciar triaje' },
  'dash.history': { pt: 'Histórico', en: 'History', fr: 'Historique', es: 'Historial' },
  'dash.triages': { pt: 'triagens', en: 'triages', fr: 'triages', es: 'triajes' },
  'dash.triage_singular': { pt: 'triagem', en: 'triage', fr: 'triage', es: 'triaje' },
  'dash.consultations_done': { pt: 'consultas concluídas', en: 'consultations completed', fr: 'consultations terminées', es: 'consultas completadas' },
  'dash.consultation_done': { pt: 'consulta concluída', en: 'consultation completed', fr: 'consultation terminée', es: 'consulta completada' },
  'dash.resolved': { pt: 'resolvido', en: 'resolved', fr: 'résolu', es: 'resuelto' },
  'dash.btn_start_triage': { pt: 'Iniciar Triagem', en: 'Start Triage', fr: 'Commencer le Triage', es: 'Iniciar Triaje' },
  'dash.btn_consultations': { pt: 'Ver Consultas', en: 'View Consultations', fr: 'Voir les Consultations', es: 'Ver Consultas' },
  'dash.btn_profile': { pt: 'Meu Perfil', en: 'My Profile', fr: 'Mon Profil', es: 'Mi Perfil' },
  'dash.recent_triages': { pt: 'Triagens Recentes', en: 'Recent Triages', fr: 'Triages Récents', es: 'Triajes Recientes' },
  'dash.view_all': { pt: 'Ver Todas', en: 'View All', fr: 'Voir Tout', es: 'Ver Todos' },
  'dash.no_triages': { pt: 'Sem triagens', en: 'No triages', fr: 'Aucun triage', es: 'Sin triajes' },
  'dash.no_triages_desc': { pt: 'Inicie a sua primeira triagem para avaliar os seus sintomas.', en: 'Start your first triage to evaluate your symptoms.', fr: 'Commencez votre premier triage pour évaluer vos symptômes.', es: 'Inicia tu primer triaje para evaluar tus síntomas.' },
  'dash.consultations': { pt: 'Consultas', en: 'Consultations', fr: 'Consultations', es: 'Consultas' },
  'dash.manage': { pt: 'Gerir', en: 'Manage', fr: 'Gérer', es: 'Gestionar' },
  'dash.no_consultations': { pt: 'Sem consultas', en: 'No consultations', fr: 'Aucune consultation', es: 'Sin consultas' },
  'dash.triage_done_book': { pt: 'Triagem concluída — marque uma consulta para ser atendido.', en: 'Triage completed — book a consultation to be seen.', fr: 'Triage terminé — prenez rendez-vous pour être vu.', es: 'Triaje completado — programa una consulta para ser atendido.' },
  'dash.complete_triage_first': { pt: 'Complete uma triagem para desbloquear o agendamento.', en: 'Complete a triage to unlock scheduling.', fr: 'Complétez un triage pour débloquer la planification.', es: 'Completa un triaje para desbloquear la programación.' },
  'dash.book_consultation': { pt: 'Marcar Consulta', en: 'Book Consultation', fr: 'Prendre Rendez-vous', es: 'Programar Consulta' },
  'dash.keep_profile': { pt: 'Mantenha o perfil atualizado', en: 'Keep your profile updated', fr: 'Gardez votre profil à jour', es: 'Mantén el perfil actualizado' },
  'dash.profile_tip': {
    pt: 'Alergias, condições crónicas e contacto de emergência melhoram a triagem.',
    en: 'Allergies, chronic conditions and emergency contact improve triage.',
    fr: 'Allergies, conditions chroniques et contact d\'urgence améliorent le triage.',
    es: 'Alergias, condiciones crónicas y contacto de emergencia mejoran el triaje.',
  },
  'dash.update_profile': { pt: 'Atualizar perfil', en: 'Update profile', fr: 'Mettre à jour le profil', es: 'Actualizar perfil' },
  // Risk labels
  'risk.urgent': { pt: 'Urgente', en: 'Urgent', fr: 'Urgent', es: 'Urgente' },
  'risk.high': { pt: 'Alto', en: 'High', fr: 'Élevé', es: 'Alto' },
  'risk.medium': { pt: 'Médio', en: 'Medium', fr: 'Moyen', es: 'Medio' },
  'risk.low': { pt: 'Baixo', en: 'Low', fr: 'Faible', es: 'Bajo' },
  // Action labels
  'action.er_now': { pt: 'Procure atendimento de urgência imediatamente', en: 'Seek emergency care immediately', fr: 'Cherchez des soins d\'urgence immédiatement', es: 'Busca atención de urgencias inmediatamente' },
  'action.doctor_now': { pt: 'Consulte um médico hoje', en: 'See a doctor today', fr: 'Consultez un médecin aujourd\'hui', es: 'Consulta un médico hoy' },
  'action.doctor_24h': { pt: 'Consulta recomendada nas próximas 24h', en: 'Consultation recommended within the next 24h', fr: 'Consultation recommandée dans les prochaines 24h', es: 'Consulta recomendada en las próximas 24h' },
  'action.self_care': { pt: 'Autocuidado com monitorização', en: 'Self-care with monitoring', fr: 'Auto-soins avec surveillance', es: 'Autocuidado con monitorización' },

  /* Table headers */
  'table.complaint': { pt: 'Queixa', en: 'Complaint', fr: 'Plainte', es: 'Queja' },
  'table.risk': { pt: 'Risco', en: 'Risk', fr: 'Risque', es: 'Riesgo' },
  'table.date': { pt: 'Data', en: 'Date', fr: 'Date', es: 'Fecha' },
  'table.specialty': { pt: 'Especialidade', en: 'Specialty', fr: 'Spécialité', es: 'Especialidad' },
  'table.status': { pt: 'Estado', en: 'Status', fr: 'Statut', es: 'Estado' },
  'table.recommendation': { pt: 'Recomendação', en: 'Recommendation', fr: 'Recommandation', es: 'Recomendación' },
  'table.score': { pt: 'Score', en: 'Score', fr: 'Score', es: 'Puntuación' },
  'table.scheduled': { pt: 'Agendada', en: 'Scheduled', fr: 'Planifiée', es: 'Programada' },
  'table.payment': { pt: 'Pagamento', en: 'Payment', fr: 'Paiement', es: 'Pago' },
  'table.created': { pt: 'Criada', en: 'Created', fr: 'Créée', es: 'Creada' },
  'table.patient': { pt: 'Paciente', en: 'Patient', fr: 'Patient', es: 'Paciente' },
  'table.actions': { pt: 'Ações', en: 'Actions', fr: 'Actions', es: 'Acciones' },

  /* ═══════════════════════════════════════════════════════════
     TRIAGE PAGE
     ═══════════════════════════════════════════════════════════ */
  'triage.title': { pt: 'Triagem Inteligente', en: 'Intelligent Triage', fr: 'Triage Intelligent', es: 'Triaje Inteligente' },
  'triage.subtitle': { pt: 'Avaliação de sintomas com classificação automática de risco', en: 'Symptom assessment with automatic risk classification', fr: 'Évaluation des symptômes avec classification automatique des risques', es: 'Evaluación de síntomas con clasificación automática de riesgo' },
  'triage.history_tab': { pt: 'Histórico', en: 'History', fr: 'Historique', es: 'Historial' },
  'triage.new_tab': { pt: 'Nova Triagem', en: 'New Triage', fr: 'Nouveau Triage', es: 'Nuevo Triaje' },
  'triage.sessions': { pt: 'Sessões de Triagem', en: 'Triage Sessions', fr: 'Sessions de Triage', es: 'Sesiones de Triaje' },
  'triage.new_btn': { pt: 'Nova Triagem', en: 'New Triage', fr: 'Nouveau Triage', es: 'Nuevo Triaje' },
  'triage.no_sessions': { pt: 'Sem triagens realizadas', en: 'No triages performed', fr: 'Aucun triage effectué', es: 'Sin triajes realizados' },
  'triage.no_sessions_desc': { pt: 'Inicie a sua primeira triagem para avaliar o seu estado de saúde.', en: 'Start your first triage to assess your health status.', fr: 'Commencez votre premier triage pour évaluer votre état de santé.', es: 'Inicia tu primer triaje para evaluar tu estado de salud.' },
  'triage.describe': { pt: 'Descreva os seus sintomas', en: 'Describe your symptoms', fr: 'Décrivez vos symptômes', es: 'Describe tus síntomas' },
  'triage.chief_complaint': { pt: 'Queixa Principal', en: 'Chief Complaint', fr: 'Plainte Principale', es: 'Queja Principal' },
  'triage.describe_placeholder': { pt: 'Descreva os sintomas que está a sentir...', en: 'Describe the symptoms you are experiencing...', fr: 'Décrivez les symptômes que vous ressentez...', es: 'Describe los síntomas que estás experimentando...' },
  'triage.starting': { pt: 'A iniciar…', en: 'Starting…', fr: 'Démarrage…', es: 'Iniciando…' },
  'triage.start_btn': { pt: 'Iniciar Triagem', en: 'Start Triage', fr: 'Commencer le Triage', es: 'Iniciar Triaje' },
  'triage.answer_questions': { pt: 'Responda às seguintes questões', en: 'Answer the following questions', fr: 'Répondez aux questions suivantes', es: 'Responde las siguientes preguntas' },
  'triage.yes': { pt: 'Sim', en: 'Yes', fr: 'Oui', es: 'Sí' },
  'triage.no': { pt: 'Não', en: 'No', fr: 'Non', es: 'No' },
  'triage.submitting': { pt: 'A avaliar…', en: 'Evaluating…', fr: 'Évaluation…', es: 'Evaluando…' },
  'triage.submit': { pt: 'Submeter Respostas', en: 'Submit Answers', fr: 'Soumettre les Réponses', es: 'Enviar Respuestas' },
  'triage.result_title': { pt: 'Resultado da Triagem', en: 'Triage Result', fr: 'Résultat du Triage', es: 'Resultado del Triaje' },
  'triage.risk_level': { pt: 'Nível de Risco', en: 'Risk Level', fr: 'Niveau de Risque', es: 'Nivel de Riesgo' },
  'triage.action_recommended': { pt: 'Ação Recomendada', en: 'Recommended Action', fr: 'Action Recommandée', es: 'Acción Recomendada' },
  'triage.new_again': { pt: 'Nova Triagem', en: 'New Triage', fr: 'Nouveau Triage', es: 'Nuevo Triaje' },
  'triage.go_consultations': { pt: 'Ver Consultas', en: 'View Consultations', fr: 'Voir les Consultations', es: 'Ver Consultas' },
  'triage.er_label': { pt: 'Dirija-se às Urgências imediatamente', en: 'Go to Emergency Room immediately', fr: 'Rendez-vous aux Urgences immédiatement', es: 'Dirígete a Urgencias inmediatamente' },
  'triage.doctor_now_label': { pt: 'Consulte um médico hoje', en: 'See a doctor today', fr: 'Consultez un médecin aujourd\'hui', es: 'Consulta un médico hoy' },
  'triage.doctor_24h_label': { pt: 'Agende consulta nas próximas 24h', en: 'Schedule consultation within 24h', fr: 'Planifiez une consultation dans les 24h', es: 'Programa una consulta en las próximas 24h' },
  'triage.self_care_label': { pt: 'Auto-cuidado com monitorização', en: 'Self-care with monitoring', fr: 'Auto-soins avec surveillance', es: 'Autocuidado con monitorización' },

  /* ═══════════════════════════════════════════════════════════
     CONSULTATIONS PAGE
     ═══════════════════════════════════════════════════════════ */
  'consult.title': { pt: 'Consultas', en: 'Consultations', fr: 'Consultations', es: 'Consultas' },
  'consult.subtitle': { pt: 'Gerir e acompanhar as suas consultas médicas', en: 'Manage and track your medical consultations', fr: 'Gérer et suivre vos consultations médicales', es: 'Gestiona y sigue tus consultas médicas' },
  'consult.tab_all': { pt: 'Todas', en: 'All', fr: 'Toutes', es: 'Todas' },
  'consult.tab_upcoming': { pt: 'Próximas', en: 'Upcoming', fr: 'À venir', es: 'Próximas' },
  'consult.tab_past': { pt: 'Passadas', en: 'Past', fr: 'Passées', es: 'Pasadas' },
  'consult.no_scheduled': { pt: 'Sem consultas agendadas', en: 'No scheduled consultations', fr: 'Aucune consultation planifiée', es: 'Sin consultas programadas' },
  'consult.no_past': { pt: 'Sem consultas passadas', en: 'No past consultations', fr: 'Aucune consultation passée', es: 'Sin consultas pasadas' },
  'consult.no_any': { pt: 'Sem consultas', en: 'No consultations', fr: 'Aucune consultation', es: 'Sin consultas' },
  'consult.self_care_msg': { pt: 'Autocuidado recomendado. Pode marcar consulta se desejar acompanhamento.', en: 'Self-care recommended. You may book a consultation for follow-up.', fr: 'Auto-soins recommandés. Vous pouvez prendre rendez-vous pour un suivi.', es: 'Autocuidado recomendado. Puedes programar una consulta para seguimiento.' },
  'consult.medium_msg': { pt: 'Consulta recomendada nas próximas 24h com base na sua triagem.', en: 'Consultation recommended within 24h based on your triage.', fr: 'Consultation recommandée dans les 24h selon votre triage.', es: 'Consulta recomendada en las próximas 24h según tu triaje.' },
  'consult.urgent_msg': { pt: 'Consulta recomendada com urgência com base na sua classificação de risco.', en: 'Urgent consultation recommended based on your risk classification.', fr: 'Consultation urgente recommandée selon votre classification de risque.', es: 'Consulta urgente recomendada según tu clasificación de riesgo.' },
  'consult.complete_first': { pt: 'Complete uma triagem para desbloquear o agendamento de consultas.', en: 'Complete a triage to unlock consultation scheduling.', fr: 'Complétez un triage pour débloquer la prise de rendez-vous.', es: 'Completa un triaje para desbloquear la programación de consultas.' },
  'consult.no_records': { pt: 'Não existem consultas registadas.', en: 'No consultations recorded.', fr: 'Aucune consultation enregistrée.', es: 'No hay consultas registradas.' },
  'consult.book_now': { pt: 'Marcar Consulta Agora', en: 'Book Consultation Now', fr: 'Prendre Rendez-vous Maintenant', es: 'Programar Consulta Ahora' },
  'consult.complete_triage': { pt: 'Completar Triagem', en: 'Complete Triage', fr: 'Compléter le Triage', es: 'Completar Triaje' },
  'consult.recommended_by': { pt: 'Recomendado: até', en: 'Recommended: by', fr: 'Recommandé : avant', es: 'Recomendado: antes del' },
  'consult.status_requested': { pt: 'Pedido', en: 'Requested', fr: 'Demandé', es: 'Solicitada' },
  'consult.status_scheduled': { pt: 'Agendada', en: 'Scheduled', fr: 'Planifiée', es: 'Programada' },
  'consult.status_in_progress': { pt: 'Em Curso', en: 'In Progress', fr: 'En Cours', es: 'En Curso' },
  'consult.status_completed': { pt: 'Concluída', en: 'Completed', fr: 'Terminée', es: 'Completada' },
  'consult.status_cancelled': { pt: 'Cancelada', en: 'Cancelled', fr: 'Annulée', es: 'Cancelada' },
  'consult.status_no_show': { pt: 'Falta', en: 'No Show', fr: 'Absent', es: 'No Se Presentó' },

  /* ═══════════════════════════════════════════════════════════
     PATIENT PROFILE PAGE
     ═══════════════════════════════════════════════════════════ */
  'profile.title': { pt: 'Perfil Clínico', en: 'Clinical Profile', fr: 'Profil Clinique', es: 'Perfil Clínico' },
  'profile.subtitle': { pt: 'Gerir os seus dados de saúde e informações pessoais', en: 'Manage your health data and personal information', fr: 'Gérer vos données de santé et informations personnelles', es: 'Gestiona tus datos de salud e información personal' },
  'profile.personal': { pt: 'Informações Pessoais', en: 'Personal Information', fr: 'Informations Personnelles', es: 'Información Personal' },
  'profile.dob': { pt: 'Data de Nascimento', en: 'Date of Birth', fr: 'Date de Naissance', es: 'Fecha de Nacimiento' },
  'profile.gender': { pt: 'Género', en: 'Gender', fr: 'Genre', es: 'Género' },
  'profile.gender_select': { pt: 'Selecionar', en: 'Select', fr: 'Sélectionner', es: 'Seleccionar' },
  'profile.gender_male': { pt: 'Masculino', en: 'Male', fr: 'Masculin', es: 'Masculino' },
  'profile.gender_female': { pt: 'Feminino', en: 'Female', fr: 'Féminin', es: 'Femenino' },
  'profile.gender_other': { pt: 'Outro', en: 'Other', fr: 'Autre', es: 'Otro' },
  'profile.blood_type': { pt: 'Tipo Sanguíneo', en: 'Blood Type', fr: 'Groupe Sanguin', es: 'Grupo Sanguíneo' },
  'profile.allergies': { pt: 'Alergias (separadas por vírgula)', en: 'Allergies (comma separated)', fr: 'Allergies (séparées par des virgules)', es: 'Alergias (separadas por coma)' },
  'profile.allergies_placeholder': { pt: 'Ex: Penicilina, Glúten', en: 'E.g.: Penicillin, Gluten', fr: 'Ex : Pénicilline, Gluten', es: 'Ej: Penicilina, Gluten' },
  'profile.chronic': { pt: 'Condições Crónicas (separadas por vírgula)', en: 'Chronic Conditions (comma separated)', fr: 'Conditions Chroniques (séparées par des virgules)', es: 'Condiciones Crónicas (separadas por coma)' },
  'profile.chronic_placeholder': { pt: 'Ex: Diabetes, Hipertensão', en: 'E.g.: Diabetes, Hypertension', fr: 'Ex : Diabète, Hypertension', es: 'Ej: Diabetes, Hipertensión' },
  'profile.emergency_name': { pt: 'Contacto de Emergência — Nome', en: 'Emergency Contact — Name', fr: 'Contact d\'Urgence — Nom', es: 'Contacto de Emergencia — Nombre' },
  'profile.emergency_name_placeholder': { pt: 'Nome do contacto', en: 'Contact name', fr: 'Nom du contact', es: 'Nombre del contacto' },
  'profile.emergency_phone': { pt: 'Contacto de Emergência — Telefone', en: 'Emergency Contact — Phone', fr: 'Contact d\'Urgence — Téléphone', es: 'Contacto de Emergencia — Teléfono' },
  'profile.save': { pt: 'Guardar Perfil', en: 'Save Profile', fr: 'Enregistrer le Profil', es: 'Guardar Perfil' },
  'profile.saving': { pt: 'A guardar…', en: 'Saving…', fr: 'Enregistrement…', es: 'Guardando…' },
  'profile.saved': { pt: 'Perfil guardado com sucesso.', en: 'Profile saved successfully.', fr: 'Profil enregistré avec succès.', es: 'Perfil guardado con éxito.' },
  'profile.save_error': { pt: 'Erro ao guardar.', en: 'Error saving.', fr: 'Erreur lors de l\'enregistrement.', es: 'Error al guardar.' },
  'profile.info_tip': {
    pt: 'Estas informações são utilizadas durante a triagem e consultas médicas. Quanto mais completo o perfil, melhor a qualidade do atendimento.',
    en: 'This information is used during triage and medical consultations. The more complete your profile, the better the quality of care.',
    fr: 'Ces informations sont utilisées lors du triage et des consultations médicales. Plus votre profil est complet, meilleure est la qualité des soins.',
    es: 'Esta información se utiliza durante el triaje y las consultas médicas. Cuanto más completo sea tu perfil, mejor será la calidad de la atención.',
  },

  /* ═══════════════════════════════════════════════════════════
     SETTINGS PAGE
     ═══════════════════════════════════════════════════════════ */
  'settings.title': { pt: 'Definições', en: 'Settings', fr: 'Paramètres', es: 'Ajustes' },
  'settings.subtitle': { pt: 'Gerir as configurações da sua conta', en: 'Manage your account settings', fr: 'Gérer les paramètres de votre compte', es: 'Gestiona la configuración de tu cuenta' },
  'settings.tab_account': { pt: 'Conta', en: 'Account', fr: 'Compte', es: 'Cuenta' },
  'settings.tab_security': { pt: 'Segurança', en: 'Security', fr: 'Sécurité', es: 'Seguridad' },
  'settings.tab_notifications': { pt: 'Notificações', en: 'Notifications', fr: 'Notifications', es: 'Notificaciones' },
  'settings.account_info': { pt: 'Informações da Conta', en: 'Account Information', fr: 'Informations du Compte', es: 'Información de la Cuenta' },
  'settings.email': { pt: 'Email', en: 'Email', fr: 'Email', es: 'Email' },
  'settings.role': { pt: 'Função', en: 'Role', fr: 'Rôle', es: 'Función' },
  'settings.name': { pt: 'Nome', en: 'Name', fr: 'Nom', es: 'Nombre' },
  'settings.contact_support': { pt: 'Para alterar estas informações, contacte o suporte.', en: 'To change this information, contact support.', fr: 'Pour modifier ces informations, contactez le support.', es: 'Para cambiar esta información, contacta con soporte.' },
  'settings.change_pw': { pt: 'Alterar Palavra-passe', en: 'Change Password', fr: 'Changer le Mot de Passe', es: 'Cambiar Contraseña' },
  'settings.current_pw': { pt: 'Palavra-passe atual', en: 'Current password', fr: 'Mot de passe actuel', es: 'Contraseña actual' },
  'settings.new_pw': { pt: 'Nova palavra-passe', en: 'New password', fr: 'Nouveau mot de passe', es: 'Nueva contraseña' },
  'settings.confirm_pw': { pt: 'Confirmar nova palavra-passe', en: 'Confirm new password', fr: 'Confirmer le nouveau mot de passe', es: 'Confirmar nueva contraseña' },
  'settings.pw_submit': { pt: 'Alterar', en: 'Change', fr: 'Modifier', es: 'Cambiar' },
  'settings.pw_loading': { pt: 'A alterar…', en: 'Changing…', fr: 'Modification…', es: 'Cambiando…' },
  'settings.pw_mismatch': { pt: 'As palavras-passe não coincidem.', en: 'Passwords do not match.', fr: 'Les mots de passe ne correspondent pas.', es: 'Las contraseñas no coinciden.' },
  'settings.pw_short': { pt: 'Mínimo 6 caracteres.', en: 'Minimum 6 characters.', fr: 'Minimum 6 caractères.', es: 'Mínimo 6 caracteres.' },
  'settings.pw_success': { pt: 'Palavra-passe alterada com sucesso.', en: 'Password changed successfully.', fr: 'Mot de passe modifié avec succès.', es: 'Contraseña cambiada con éxito.' },
  'settings.pw_error': { pt: 'Erro ao alterar.', en: 'Error changing password.', fr: 'Erreur lors du changement de mot de passe.', es: 'Error al cambiar la contraseña.' },
  'settings.notif_title': { pt: 'Preferências de Notificação', en: 'Notification Preferences', fr: 'Préférences de Notification', es: 'Preferencias de Notificación' },
  'settings.notif_triage': { pt: 'Alertas de Triagem', en: 'Triage Alerts', fr: 'Alertes de Triage', es: 'Alertas de Triaje' },
  'settings.notif_consult': { pt: 'Lembretes de Consulta', en: 'Consultation Reminders', fr: 'Rappels de Consultation', es: 'Recordatorios de Consulta' },
  'settings.notif_updates': { pt: 'Atualizações da Plataforma', en: 'Platform Updates', fr: 'Mises à jour de la Plateforme', es: 'Actualizaciones de la Plataforma' },
  'settings.notif_promo': { pt: 'Emails Promocionais', en: 'Promotional Emails', fr: 'Emails Promotionnels', es: 'Emails Promocionales' },

  /* ═══════════════════════════════════════════════════════════
     CONSENTS PAGE
     ═══════════════════════════════════════════════════════════ */
  'consents.title': { pt: 'Consentimentos', en: 'Consents', fr: 'Consentements', es: 'Consentimientos' },
  'consents.subtitle': { pt: 'Gerir os seus consentimentos e autorizações de saúde', en: 'Manage your health consents and authorizations', fr: 'Gérer vos consentements et autorisations de santé', es: 'Gestiona tus consentimientos y autorizaciones de salud' },
  'consents.new': { pt: 'Novo Consentimento', en: 'New Consent', fr: 'Nouveau Consentement', es: 'Nuevo Consentimiento' },
  'consents.type': { pt: 'Tipo de Consentimento', en: 'Consent Type', fr: 'Type de Consentement', es: 'Tipo de Consentimiento' },
  'consents.select': { pt: 'Selecionar', en: 'Select', fr: 'Sélectionner', es: 'Seleccionar' },
  'consents.accept': { pt: 'Aceitar', en: 'Accept', fr: 'Accepter', es: 'Aceptar' },
  'consents.accepting': { pt: 'A registar…', en: 'Registering…', fr: 'Enregistrement…', es: 'Registrando…' },
  'consents.registered': { pt: 'Consentimento registado.', en: 'Consent registered.', fr: 'Consentement enregistré.', es: 'Consentimiento registrado.' },
  'consents.active': { pt: 'Consentimentos Ativos', en: 'Active Consents', fr: 'Consentements Actifs', es: 'Consentimientos Activos' },
  'consents.none': { pt: 'Sem consentimentos', en: 'No consents', fr: 'Aucun consentement', es: 'Sin consentimientos' },
  'consents.none_desc': { pt: 'Adicione os consentimentos necessários para usufruir de todos os serviços.', en: 'Add the necessary consents to enjoy all services.', fr: 'Ajoutez les consentements nécessaires pour profiter de tous les services.', es: 'Añade los consentimientos necesarios para disfrutar de todos los servicios.' },
  'consents.accepted_at': { pt: 'Aceite em', en: 'Accepted on', fr: 'Accepté le', es: 'Aceptado el' },
  'consents.type_data': { pt: 'Partilha de Dados Clínicos', en: 'Clinical Data Sharing', fr: 'Partage de Données Cliniques', es: 'Compartición de Datos Clínicos' },
  'consents.type_teleconsult': { pt: 'Teleconsulta', en: 'Teleconsultation', fr: 'Téléconsultation', es: 'Teleconsulta' },
  'consents.type_prescription': { pt: 'Prescrição Digital', en: 'Digital Prescription', fr: 'Prescription Numérique', es: 'Receta Digital' },
  'consents.type_notifications': { pt: 'Notificações de Saúde', en: 'Health Notifications', fr: 'Notifications de Santé', es: 'Notificaciones de Salud' },
  'consents.type_research': { pt: 'Investigação Clínica', en: 'Clinical Research', fr: 'Recherche Clinique', es: 'Investigación Clínica' },

  /* ═══════════════════════════════════════════════════════════
     DOCTOR PROFILE PAGE
     ═══════════════════════════════════════════════════════════ */
  'doctor.title': { pt: 'Perfil Médico', en: 'Doctor Profile', fr: 'Profil Médecin', es: 'Perfil Médico' },
  'doctor.subtitle': { pt: 'Gerir as suas credenciais e informações profissionais', en: 'Manage your credentials and professional information', fr: 'Gérer vos identifiants et informations professionnelles', es: 'Gestiona tus credenciales e información profesional' },
  'doctor.verification': { pt: 'Estado de verificação:', en: 'Verification status:', fr: 'Statut de vérification :', es: 'Estado de verificación:' },
  'doctor.verified': { pt: 'Verificado', en: 'Verified', fr: 'Vérifié', es: 'Verificado' },
  'doctor.pending': { pt: 'Pendente', en: 'Pending', fr: 'En attente', es: 'Pendiente' },
  'doctor.rejected': { pt: 'Rejeitado', en: 'Rejected', fr: 'Rejeté', es: 'Rechazado' },
  'doctor.professional': { pt: 'Dados Profissionais', en: 'Professional Data', fr: 'Données Professionnelles', es: 'Datos Profesionales' },
  'doctor.license': { pt: 'Número de Licença', en: 'License Number', fr: 'Numéro de Licence', es: 'Número de Licencia' },
  'doctor.specialization': { pt: 'Especialização', en: 'Specialization', fr: 'Spécialisation', es: 'Especialización' },
  'doctor.bio': { pt: 'Biografia', en: 'Biography', fr: 'Biographie', es: 'Biografía' },
  'doctor.bio_placeholder': { pt: 'Breve descrição profissional...', en: 'Brief professional description...', fr: 'Brève description professionnelle...', es: 'Breve descripción profesional...' },
  'doctor.save': { pt: 'Guardar', en: 'Save', fr: 'Enregistrer', es: 'Guardar' },
  'doctor.saving': { pt: 'A guardar…', en: 'Saving…', fr: 'Enregistrement…', es: 'Guardando…' },
  'doctor.saved': { pt: 'Perfil médico guardado.', en: 'Doctor profile saved.', fr: 'Profil médecin enregistré.', es: 'Perfil médico guardado.' },

  /* ═══════════════════════════════════════════════════════════
     DOCTOR QUEUE PAGE
     ═══════════════════════════════════════════════════════════ */
  'queue.title': { pt: 'Fila de Espera', en: 'Queue', fr: 'File d\'Attente', es: 'Cola de Espera' },
  'queue.subtitle': { pt: 'Consultas pendentes e em curso atribuídas a si', en: 'Pending and ongoing consultations assigned to you', fr: 'Consultations en attente et en cours qui vous sont attribuées', es: 'Consultas pendientes y en curso asignadas a usted' },
  'queue.patients': { pt: 'Pacientes na Fila', en: 'Patients in Queue', fr: 'Patients en File', es: 'Pacientes en Cola' },
  'queue.empty': { pt: 'Fila vazia', en: 'Queue empty', fr: 'File vide', es: 'Cola vacía' },
  'queue.empty_desc': { pt: 'Não existem consultas pendentes de momento.', en: 'No pending consultations at the moment.', fr: 'Aucune consultation en attente pour le moment.', es: 'No hay consultas pendientes en este momento.' },
  'queue.start': { pt: 'Iniciar', en: 'Start', fr: 'Commencer', es: 'Iniciar' },
  'queue.complete': { pt: 'Concluir', en: 'Complete', fr: 'Terminer', es: 'Completar' },

  /* ═══════════════════════════════════════════════════════════
     ADMIN DASHBOARD PAGE
     ═══════════════════════════════════════════════════════════ */
  'admin.label': { pt: 'Administração', en: 'Administration', fr: 'Administration', es: 'Administración' },
  'admin.title': { pt: 'Dashboard Admin', en: 'Admin Dashboard', fr: 'Tableau de Bord Admin', es: 'Panel Admin' },
  'admin.subtitle': { pt: 'Métricas da plataforma e indicadores de negócio', en: 'Platform metrics and business indicators', fr: 'Métriques de la plateforme et indicateurs business', es: 'Métricas de la plataforma e indicadores de negocio' },
  'admin.patients': { pt: 'Pacientes', en: 'Patients', fr: 'Patients', es: 'Pacientes' },
  'admin.doctors': { pt: 'Médicos', en: 'Doctors', fr: 'Médecins', es: 'Médicos' },
  'admin.pending': { pt: 'Pendentes', en: 'Pending', fr: 'En attente', es: 'Pendientes' },
  'admin.active_patients': { pt: 'Pacientes Ativos (30d)', en: 'Active Patients (30d)', fr: 'Patients Actifs (30j)', es: 'Pacientes Activos (30d)' },
  'admin.consult_month': { pt: 'Consultas (Mês)', en: 'Consultations (Month)', fr: 'Consultations (Mois)', es: 'Consultas (Mes)' },
  'admin.resolution_rate': { pt: 'Taxa de Resolução', en: 'Resolution Rate', fr: 'Taux de Résolution', es: 'Tasa de Resolución' },
  'admin.total_consult': { pt: 'Total Consultas', en: 'Total Consultations', fr: 'Total Consultations', es: 'Total Consultas' },
  'admin.revenue': { pt: 'Receita (Mês)', en: 'Revenue (Month)', fr: 'Revenus (Mois)', es: 'Ingresos (Mes)' },
  'admin.risk_dist': { pt: 'Distribuição de Risco', en: 'Risk Distribution', fr: 'Distribution des Risques', es: 'Distribución de Riesgo' },
  'admin.no_triage_data': { pt: 'Sem dados de triagem.', en: 'No triage data.', fr: 'Aucune donnée de triage.', es: 'Sin datos de triaje.' },
  'admin.attention': { pt: 'Atenção Necessária', en: 'Attention Needed', fr: 'Attention Requise', es: 'Atención Requerida' },
  'admin.pending_doctors': { pt: 'Médico(s) Pendente(s)', en: 'Pending Doctor(s)', fr: 'Médecin(s) en Attente', es: 'Médico(s) Pendiente(s)' },
  'admin.pending_desc': { pt: 'Aguardam verificação de credenciais.', en: 'Awaiting credential verification.', fr: 'En attente de vérification des identifiants.', es: 'Esperan verificación de credenciales.' },
  'admin.verify': { pt: 'Verificar', en: 'Verify', fr: 'Vérifier', es: 'Verificar' },
  'admin.urgent_triages': { pt: 'Triagens Urgentes', en: 'Urgent Triages', fr: 'Triages Urgents', es: 'Triajes Urgentes' },
  'admin.urgent_desc': { pt: 'Classificação de risco URGENTE detectada.', en: 'URGENT risk classification detected.', fr: 'Classification de risque URGENT détectée.', es: 'Clasificación de riesgo URGENTE detectada.' },
  'admin.no_pending': { pt: 'Sem itens pendentes', en: 'No pending items', fr: 'Aucun élément en attente', es: 'Sin elementos pendientes' },

  /* ═══════════════════════════════════════════════════════════
     COMMON / MISC
     ═══════════════════════════════════════════════════════════ */
  'common.loading': { pt: 'A carregar...', en: 'Loading...', fr: 'Chargement...', es: 'Cargando...' },
  'common.error': { pt: 'Erro', en: 'Error', fr: 'Erreur', es: 'Error' },
  'common.save': { pt: 'Guardar', en: 'Save', fr: 'Enregistrer', es: 'Guardar' },
  'common.cancel': { pt: 'Cancelar', en: 'Cancel', fr: 'Annuler', es: 'Cancelar' },
  'common.select': { pt: 'Selecionar', en: 'Select', fr: 'Sélectionner', es: 'Seleccionar' },
  'common.go_to_page': { pt: 'Ir para a página', en: 'Go to page', fr: 'Aller à la page', es: 'Ir a la página' },

  /* ═══════════════════════════════════════════════════════════
     CHAT WIDGET
     ═══════════════════════════════════════════════════════════ */
  'chat.open': { pt: 'Abrir assistente', en: 'Open assistant', fr: 'Ouvrir l\'assistant', es: 'Abrir asistente' },
  'chat.close': { pt: 'Fechar', en: 'Close', fr: 'Fermer', es: 'Cerrar' },
  'chat.title': { pt: 'Assistente Health', en: 'Health Assistant', fr: 'Assistant Santé', es: 'Asistente Health' },
  'chat.error': { pt: 'Desculpe, ocorreu um erro. Tente novamente.', en: 'Sorry, an error occurred. Please try again.', fr: 'Désolé, une erreur est survenue. Veuillez réessayer.', es: 'Lo sentimos, ocurrió un error. Inténtalo de nuevo.' },
  'chat.placeholder': { pt: 'Escreva a sua mensagem...', en: 'Type your message...', fr: 'Écrivez votre message...', es: 'Escribe tu mensaje...' },
  'chat.send': { pt: 'Enviar', en: 'Send', fr: 'Envoyer', es: 'Enviar' },

  /* ═══════════════════════════════════════════════════════════
     DOCTOR SPECIALIZATIONS (used in DoctorProfilePage select)
     ═══════════════════════════════════════════════════════════ */
  'spec.general': { pt: 'Clínica Geral', en: 'General Practice', fr: 'Médecine Générale', es: 'Medicina General' },
  'spec.cardiology': { pt: 'Cardiologia', en: 'Cardiology', fr: 'Cardiologie', es: 'Cardiología' },
  'spec.dermatology': { pt: 'Dermatologia', en: 'Dermatology', fr: 'Dermatologie', es: 'Dermatología' },
  'spec.pediatrics': { pt: 'Pediatria', en: 'Pediatrics', fr: 'Pédiatrie', es: 'Pediatría' },
  'spec.orthopedics': { pt: 'Ortopedia', en: 'Orthopedics', fr: 'Orthopédie', es: 'Ortopedia' },
  'spec.neurology': { pt: 'Neurologia', en: 'Neurology', fr: 'Neurologie', es: 'Neurología' },
  'spec.gynecology': { pt: 'Ginecologia', en: 'Gynecology', fr: 'Gynécologie', es: 'Ginecología' },
  'spec.ophthalmology': { pt: 'Oftalmologia', en: 'Ophthalmology', fr: 'Ophtalmologie', es: 'Oftalmología' },
  'spec.psychiatry': { pt: 'Psiquiatria', en: 'Psychiatry', fr: 'Psychiatrie', es: 'Psiquiatría' },
  'spec.internal': { pt: 'Medicina Interna', en: 'Internal Medicine', fr: 'Médecine Interne', es: 'Medicina Interna' },
  'spec.surgery': { pt: 'Cirurgia Geral', en: 'General Surgery', fr: 'Chirurgie Générale', es: 'Cirugía General' },
  'spec.other': { pt: 'Outra', en: 'Other', fr: 'Autre', es: 'Otra' },

  /* ═══════════════════════════════════════════════════════════
     DASHBOARD TABS
     ═══════════════════════════════════════════════════════════ */
  'dash.score': { pt: 'Score:', en: 'Score:', fr: 'Score :', es: 'Puntuación:' },
  'dash.tab_summary': { pt: 'Resumo', en: 'Summary', fr: 'Résumé', es: 'Resumen' },
  'dash.tab_triages': { pt: 'Triagens', en: 'Triages', fr: 'Triages', es: 'Triajes' },
  'dash.tab_consultations': { pt: 'Consultas', en: 'Consultations', fr: 'Consultations', es: 'Consultas' },
  'dash.tab_profile': { pt: 'Perfil', en: 'Profile', fr: 'Profil', es: 'Perfil' },

  /* Dashboard — Quick Actions (La Meva Salut) */
  'dash.quick_actions': { pt: 'Acesso Rápido', en: 'Quick Access', fr: 'Accès Rapide', es: 'Acceso Rápido' },
  'dash.qa_triage': { pt: 'Triagem', en: 'Triage', fr: 'Triage', es: 'Triaje' },
  'dash.qa_appointments': { pt: 'Consultas', en: 'Appointments', fr: 'Rendez-vous', es: 'Consultas' },
  'dash.qa_medication': { pt: 'Medicação', en: 'Medication', fr: 'Médicaments', es: 'Medicación' },
  'dash.qa_econsulta': { pt: 'eConsulta', en: 'eConsult', fr: 'eConsultation', es: 'eConsulta' },
  'dash.qa_doctors': { pt: 'Médicos', en: 'Doctors', fr: 'Médecins', es: 'Médicos' },
  'dash.qa_results': { pt: 'Resultados', en: 'Results', fr: 'Résultats', es: 'Resultados' },
  'dash.qa_consents': { pt: 'Consentimentos', en: 'Consents', fr: 'Consentements', es: 'Consentimientos' },
  'dash.qa_profile': { pt: 'Perfil', en: 'Profile', fr: 'Profil', es: 'Perfil' },

  /* Dashboard — Highlights / Destaques */
  'dash.highlights': { pt: 'Destaques', en: 'Highlights', fr: 'En vedette', es: 'Destacados' },
  'dash.hl_hydration': { pt: 'Mantenha-se hidratado', en: 'Stay hydrated', fr: 'Restez hydraté(e)', es: 'Mantenerse hidratado' },
  'dash.hl_hydration_desc': { pt: 'Beba pelo menos 2L de água por dia para manter o corpo saudável.', en: 'Drink at least 2L of water per day to keep your body healthy.', fr: 'Buvez au moins 2L d\'eau par jour pour garder votre corps en bonne santé.', es: 'Bebe al menos 2L de agua al día para mantener el cuerpo saludable.' },
  'dash.hl_sleep': { pt: 'Durma bem', en: 'Sleep well', fr: 'Dormez bien', es: 'Duerme bien' },
  'dash.hl_sleep_desc': { pt: '7 a 9 horas de sono por noite são essenciais para a recuperação.', en: '7 to 9 hours of sleep per night are essential for recovery.', fr: '7 à 9 heures de sommeil par nuit sont essentielles pour la récupération.', es: '7 a 9 horas de sueño por noche son esenciales para la recuperación.' },
  'dash.hl_nutrition': { pt: 'Alimentação equilibrada', en: 'Balanced diet', fr: 'Alimentation équilibrée', es: 'Alimentación equilibrada' },
  'dash.hl_nutrition_desc': { pt: 'Inclua frutas, vegetais e proteínas na sua dieta diária.', en: 'Include fruits, vegetables and proteins in your daily diet.', fr: 'Incluez des fruits, des légumes et des protéines dans votre alimentation quotidienne.', es: 'Incluye frutas, verduras y proteínas en tu dieta diaria.' },
  'dash.hl_checkup': { pt: 'Check-up regular', en: 'Regular check-up', fr: 'Bilan régulier', es: 'Chequeo regular' },
  'dash.hl_checkup_desc': { pt: 'Realize exames preventivos pelo menos uma vez por ano.', en: 'Have preventive exams at least once a year.', fr: 'Faites des examens préventifs au moins une fois par an.', es: 'Realiza exámenes preventivos al menos una vez al año.' },

  /* Dashboard — Chronic Diseases Section */
  'dash.chronic_title': { pt: 'Doenças Crónicas', en: 'Chronic Diseases', fr: 'Maladies Chroniques', es: 'Enfermedades Crónicas' },
  'dash.no_chronic': { pt: 'Sem condições crónicas registadas', en: 'No chronic conditions registered', fr: 'Aucune condition chronique enregistrée', es: 'Sin condiciones crónicas registradas' },
  'dash.no_chronic_desc': { pt: 'Adicione as suas condições crónicas no perfil para acompanhamento personalizado.', en: 'Add your chronic conditions in your profile for personalized follow-up.', fr: 'Ajoutez vos conditions chroniques dans votre profil pour un suivi personnalisé.', es: 'Añade tus condiciones crónicas en el perfil para seguimiento personalizado.' },
  'dash.chronic_tip_diabetes': { pt: 'Monitorize a glicemia regularmente. Mantenha uma dieta equilibrada, pratique exercício e tome a medicação conforme prescrito.', en: 'Monitor blood sugar regularly. Maintain a balanced diet, exercise and take medication as prescribed.', fr: 'Surveillez votre glycémie régulièrement. Maintenez une alimentation équilibrée, faites de l\'exercice et prenez vos médicaments comme prescrit.', es: 'Monitoriza la glucemia regularmente. Mantén una dieta equilibrada, practica ejercicio y toma la medicación según lo prescrito.' },
  'dash.chronic_tip_hypertension': { pt: 'Controle a pressão arterial diariamente. Reduza o sal, faça exercício regular e tome a medicação anti-hipertensiva conforme indicado.', en: 'Monitor blood pressure daily. Reduce salt intake, exercise regularly and take antihypertensive medication as directed.', fr: 'Contrôlez votre tension artérielle quotidiennement. Réduisez le sel, faites de l\'exercice régulièrement et prenez vos médicaments antihypertenseurs comme indiqué.', es: 'Controla la presión arterial diariamente. Reduce la sal, haz ejercicio regular y toma la medicación antihipertensiva según las indicaciones.' },
  'dash.chronic_tip_asthma': { pt: 'Tenha sempre o inalador de resgate consigo. Evite alérgenos conhecidos, poluição e fumo. Siga o plano de ação para crises.', en: 'Always carry your rescue inhaler. Avoid known allergens, pollution and smoke. Follow your crisis action plan.', fr: 'Ayez toujours votre inhalateur de secours. Évitez les allergènes connus, la pollution et la fumée. Suivez votre plan d\'action pour les crises.', es: 'Lleva siempre el inhalador de rescate. Evita alérgenos conocidos, contaminación y humo. Sigue el plan de acción para las crisis.' },
  'dash.chronic_tip_copd': { pt: 'Não fume e evite fumo passivo. Use broncodilatadores conforme prescrito e faça reabilitação pulmonar se indicado.', en: 'Do not smoke and avoid secondhand smoke. Use bronchodilators as prescribed and attend pulmonary rehabilitation if indicated.', fr: 'Ne fumez pas et évitez le tabagisme passif. Utilisez les bronchodilatateurs comme prescrit et participez à la réhabilitation pulmonaire si indiqué.', es: 'No fumes y evita el humo de segunda mano. Usa broncodilatadores según lo prescrito y realiza rehabilitación pulmonar si se indica.' },
  'dash.chronic_tip_epilepsy': { pt: 'Tome a medicação antiepiléptica todos os dias à mesma hora. Evite privação de sono, álcool em excesso e situações de stress extremo. Informe quem o rodeia sobre como agir numa crise.', en: 'Take antiepileptic medication every day at the same time. Avoid sleep deprivation, excessive alcohol and extreme stress. Inform those around you about how to act during a seizure.', fr: 'Prenez vos médicaments antiépileptiques tous les jours à la même heure. Évitez le manque de sommeil, l\'alcool excessif et le stress extrême. Informez votre entourage sur la conduite à tenir en cas de crise.', es: 'Toma la medicación antiepiléptica todos los días a la misma hora. Evita la privación de sueño, el alcohol en exceso y el estrés extremo. Informa a quienes te rodean sobre cómo actuar durante una crisis.' },
  'dash.chronic_tip_sickle': { pt: 'Mantenha-se hidratado e evite temperaturas extremas. Tome ácido fólico conforme prescrito e procure assistência médica em caso de crise de dor.', en: 'Stay hydrated and avoid extreme temperatures. Take folic acid as prescribed and seek medical attention during pain crises.', fr: 'Restez hydraté(e) et évitez les températures extrêmes. Prenez l\'acide folique comme prescrit et consultez en cas de crise douloureuse.', es: 'Mantente hidratado y evita temperaturas extremas. Toma ácido fólico según lo prescrito y busca atención médica en caso de crisis de dolor.' },
  'dash.chronic_tip_hiv': { pt: 'Tome a terapia antirretroviral diariamente sem interrupções. Faça análises regulares de carga viral e CD4. Mantenha consultas de acompanhamento.', en: 'Take antiretroviral therapy daily without interruptions. Have regular viral load and CD4 tests. Keep follow-up appointments.', fr: 'Prenez votre traitement antirétroviral quotidiennement sans interruption. Faites des analyses régulières de charge virale et CD4. Maintenez vos rendez-vous de suivi.', es: 'Toma la terapia antirretroviral diariamente sin interrupciones. Realiza pruebas regulares de carga viral y CD4. Mantén las citas de seguimiento.' },
  'dash.chronic_tip_tb': { pt: 'Complete todo o tratamento prescrito, mesmo que se sinta melhor. Tome os medicamentos à mesma hora todos os dias. Consultas de controlo são essenciais.', en: 'Complete the entire prescribed treatment, even if you feel better. Take medications at the same time every day. Follow-up appointments are essential.', fr: 'Complétez l\'intégralité du traitement prescrit, même si vous vous sentez mieux. Prenez vos médicaments à la même heure chaque jour. Les consultations de contrôle sont essentielles.', es: 'Completa todo el tratamiento prescrito, incluso si te sientes mejor. Toma los medicamentos a la misma hora todos los días. Las consultas de control son esenciales.' },
  'dash.chronic_tip_kidney': { pt: 'Controle a pressão arterial e a glicemia. Siga a dieta renal prescrita (reduza potássio, fósforo e sal). Não falte às sessões de diálise se indicadas.', en: 'Control blood pressure and blood sugar. Follow the prescribed renal diet (reduce potassium, phosphorus and salt). Do not miss dialysis sessions if indicated.', fr: 'Contrôlez votre tension artérielle et votre glycémie. Suivez le régime rénal prescrit (réduisez le potassium, le phosphore et le sel). Ne manquez pas les séances de dialyse si indiquées.', es: 'Controla la presión arterial y la glucemia. Sigue la dieta renal prescrita (reduce potasio, fósforo y sal). No faltes a las sesiones de diálisis si están indicadas.' },
  'dash.chronic_tip_heart': { pt: 'Faça exercício moderado regularmente. Controle o colesterol e a pressão arterial. Tome a medicação cardíaca conforme prescrito.', en: 'Exercise moderately and regularly. Control cholesterol and blood pressure. Take cardiac medication as prescribed.', fr: 'Faites de l\'exercice modéré régulièrement. Contrôlez votre cholestérol et votre tension artérielle. Prenez vos médicaments cardiaques comme prescrit.', es: 'Haz ejercicio moderado regularmente. Controla el colesterol y la presión arterial. Toma la medicación cardíaca según lo prescrito.' },
  'dash.chronic_tip_arthritis': { pt: 'Pratique exercício de baixo impacto (natação, caminhada). Tome anti-inflamatórios conforme prescrito. Consulte reumatologista regularmente.', en: 'Practice low-impact exercise (swimming, walking). Take anti-inflammatory medication as prescribed. See your rheumatologist regularly.', fr: 'Pratiquez des exercices à faible impact (natation, marche). Prenez vos anti-inflammatoires comme prescrit. Consultez votre rhumatologue régulièrement.', es: 'Practica ejercicio de bajo impacto (natación, caminata). Toma antiinflamatorios según lo prescrito. Consulta al reumatólogo regularmente.' },
  'dash.chronic_tip_parkinson': { pt: 'Tome a medicação nos horários exactos. Faça fisioterapia e exercícios de equilíbrio. Mantenha acompanhamento neurológico regular.', en: 'Take medication at exact times. Do physiotherapy and balance exercises. Maintain regular neurological follow-up.', fr: 'Prenez vos médicaments aux heures exactes. Faites de la physiothérapie et des exercices d\'équilibre. Maintenez un suivi neurologique régulier.', es: 'Toma la medicación en los horarios exactos. Realiza fisioterapia y ejercicios de equilibrio. Mantén seguimiento neurológico regular.' },
  'dash.chronic_tip_alzheimer': { pt: 'Mantenha rotinas diárias estáveis. Estimule a mente com jogos e leitura. O acompanhamento neurológico é essencial para ajustar a medicação.', en: 'Maintain stable daily routines. Stimulate the mind with games and reading. Neurological follow-up is essential to adjust medication.', fr: 'Maintenez des routines quotidiennes stables. Stimulez votre esprit avec des jeux et de la lecture. Le suivi neurologique est essentiel pour ajuster les médicaments.', es: 'Mantén rutinas diarias estables. Estimula la mente con juegos y lectura. El seguimiento neurológico es esencial para ajustar la medicación.' },
  'dash.chronic_tip_ms': { pt: 'Siga a terapia modificadora de doença prescrita. Faça reabilitação física regular. Evite calor excessivo que pode agravar sintomas.', en: 'Follow prescribed disease-modifying therapy. Do regular physical rehabilitation. Avoid excessive heat that can worsen symptoms.', fr: 'Suivez la thérapie modificatrice de la maladie prescrite. Faites de la réhabilitation physique régulière. Évitez la chaleur excessive qui peut aggraver les symptômes.', es: 'Sigue la terapia modificadora de la enfermedad prescrita. Realiza rehabilitación física regular. Evita el calor excesivo que puede empeorar los síntomas.' },
  'dash.chronic_tip_fibromyalgia': { pt: 'Durma 7-9 horas por noite. Faça exercício aeróbico suave regularmente. Técnicas de relaxamento podem ajudar a gerir a dor.', en: 'Sleep 7-9 hours per night. Do gentle aerobic exercise regularly. Relaxation techniques can help manage pain.', fr: 'Dormez 7 à 9 heures par nuit. Faites de l\'exercice aérobique doux régulièrement. Les techniques de relaxation peuvent aider à gérer la douleur.', es: 'Duerme 7-9 horas por noche. Realiza ejercicio aeróbico suave regularmente. Las técnicas de relajación pueden ayudar a manejar el dolor.' },
  'dash.chronic_tip_default': { pt: 'Siga o plano de tratamento do seu médico. Mantenha consultas regulares e tome a medicação conforme prescrito.', en: 'Follow your doctor\'s treatment plan. Keep regular appointments and take medication as prescribed.', fr: 'Suivez le plan de traitement de votre médecin. Maintenez des consultations régulières et prenez vos médicaments comme prescrit.', es: 'Sigue el plan de tratamiento de tu médico. Mantén consultas regulares y toma la medicación según lo prescrito.' },

  /* ═══════════════════════════════════════════════════════════
     SELF-CARE PAGE
     ═══════════════════════════════════════════════════════════ */
  'selfcare.title': { pt: 'Autocuidado', en: 'Self-Care', fr: 'Auto-soins', es: 'Autocuidado' },
  'selfcare.subtitle': { pt: 'Recomendações personalizadas para o seu bem-estar', en: 'Personalized recommendations for your well-being', fr: 'Recommandations personnalisées pour votre bien-être', es: 'Recomendaciones personalizadas para tu bienestar' },
  'selfcare.good_news': { pt: 'Boa notícia!', en: 'Good news!', fr: 'Bonne nouvelle !', es: '¡Buenas noticias!' },
  'selfcare.low_risk_msg': {
    pt: 'A sua triagem indica risco baixo. Siga estas recomendações de autocuidado e monitorize os seus sintomas.',
    en: 'Your triage indicates low risk. Follow these self-care recommendations and monitor your symptoms.',
    fr: 'Votre triage indique un risque faible. Suivez ces recommandations d\'auto-soins et surveillez vos symptômes.',
    es: 'Tu triaje indica riesgo bajo. Sigue estas recomendaciones de autocuidado y monitoriza tus síntomas.',
  },
  'selfcare.tip_hydration': { pt: 'Mantenha-se hidratado(a)', en: 'Stay hydrated', fr: 'Restez hydraté(e)', es: 'Mantente hidratado/a' },
  'selfcare.tip_hydration_desc': { pt: 'Beba pelo menos 2L de água por dia. Evite bebidas alcoólicas e com cafeína em excesso.', en: 'Drink at least 2L of water per day. Avoid excessive alcohol and caffeine.', fr: 'Buvez au moins 2L d\'eau par jour. Évitez l\'alcool et la caféine en excès.', es: 'Bebe al menos 2L de agua al día. Evita el alcohol y la cafeína en exceso.' },
  'selfcare.tip_rest': { pt: 'Descanse adequadamente', en: 'Rest adequately', fr: 'Reposez-vous adéquatement', es: 'Descansa adecuadamente' },
  'selfcare.tip_rest_desc': { pt: 'Durma 7-9 horas por noite. O repouso é essencial para a recuperação.', en: 'Sleep 7-9 hours per night. Rest is essential for recovery.', fr: 'Dormez 7 à 9 heures par nuit. Le repos est essentiel pour la récupération.', es: 'Duerme 7-9 horas por noche. El descanso es esencial para la recuperación.' },
  'selfcare.tip_monitor': { pt: 'Monitorize os sintomas', en: 'Monitor your symptoms', fr: 'Surveillez vos symptômes', es: 'Monitoriza los síntomas' },
  'selfcare.tip_monitor_desc': { pt: 'Se os sintomas piorarem ou surgirem novos, realize uma nova triagem ou consulte um médico.', en: 'If symptoms worsen or new ones appear, perform a new triage or consult a doctor.', fr: 'Si les symptômes s\'aggravent ou de nouveaux apparaissent, effectuez un nouveau triage ou consultez un médecin.', es: 'Si los síntomas empeoran o aparecen otros nuevos, realiza un nuevo triaje o consulta a un médico.' },
  'selfcare.tip_medication': { pt: 'Medicação de venda livre', en: 'Over-the-counter medication', fr: 'Médicaments en vente libre', es: 'Medicación sin receta' },
  'selfcare.tip_medication_desc': { pt: 'Para alívio sintomático, pode considerar paracetamol ou ibuprofeno conforme as indicações da embalagem.', en: 'For symptomatic relief, you may consider paracetamol or ibuprofen as per package directions.', fr: 'Pour un soulagement symptomatique, vous pouvez envisager du paracétamol ou de l\'ibuprofène selon les indications de l\'emballage.', es: 'Para alivio sintomático, puedes considerar paracetamol o ibuprofeno según las indicaciones del envase.' },
  'selfcare.tip_diet': { pt: 'Alimentação equilibrada', en: 'Balanced diet', fr: 'Alimentation équilibrée', es: 'Alimentación equilibrada' },
  'selfcare.tip_diet_desc': { pt: 'Prefira alimentos leves e nutritivos. Evite processados e açúcares em excesso.', en: 'Prefer light and nutritious foods. Avoid processed foods and excess sugar.', fr: 'Préférez des aliments légers et nutritifs. Évitez les aliments transformés et le sucre en excès.', es: 'Prefiere alimentos ligeros y nutritivos. Evita los procesados y el azúcar en exceso.' },
  'selfcare.tip_exercise': { pt: 'Atividade física moderada', en: 'Moderate physical activity', fr: 'Activité physique modérée', es: 'Actividad física moderada' },
  'selfcare.tip_exercise_desc': { pt: 'Se se sentir bem, caminhe ou faça exercício leve. Evite esforços intensos.', en: 'If you feel well, walk or do light exercise. Avoid intense exertion.', fr: 'Si vous vous sentez bien, marchez ou faites de l\'exercice léger. Évitez les efforts intenses.', es: 'Si te sientes bien, camina o haz ejercicio ligero. Evita los esfuerzos intensos.' },
  'selfcare.when_seek': { pt: 'Quando procurar ajuda médica', en: 'When to seek medical help', fr: 'Quand consulter un médecin', es: 'Cuándo buscar ayuda médica' },
  'selfcare.seek_desc': { pt: 'Procure atendimento médico se:', en: 'Seek medical care if:', fr: 'Consultez un médecin si :', es: 'Busca atención médica si:' },
  'selfcare.seek_1': { pt: 'Os sintomas piorarem significativamente', en: 'Symptoms worsen significantly', fr: 'Les symptômes s\'aggravent significativement', es: 'Los síntomas empeoran significativamente' },
  'selfcare.seek_2': { pt: 'Surgirem novos sintomas preocupantes', en: 'New concerning symptoms appear', fr: 'De nouveaux symptômes préoccupants apparaissent', es: 'Aparecen nuevos síntomas preocupantes' },
  'selfcare.seek_3': { pt: 'Febre superior a 38.5°C por mais de 48h', en: 'Fever above 38.5°C for more than 48h', fr: 'Fièvre supérieure à 38,5°C pendant plus de 48h', es: 'Fiebre superior a 38.5°C durante más de 48h' },
  'selfcare.seek_4': { pt: 'Dificuldade em respirar ou dor intensa', en: 'Difficulty breathing or severe pain', fr: 'Difficulté à respirer ou douleur intense', es: 'Dificultad para respirar o dolor intenso' },
  'selfcare.new_triage': { pt: 'Nova Triagem', en: 'New Triage', fr: 'Nouveau Triage', es: 'Nuevo Triaje' },
  'selfcare.book_anyway': { pt: 'Marcar Consulta Mesmo Assim', en: 'Book Consultation Anyway', fr: 'Prendre Rendez-vous Quand Même', es: 'Programar Consulta de Todos Modos' },
  'selfcare.back_dashboard': { pt: '← Voltar ao Dashboard', en: '← Back to Dashboard', fr: '← Retour au Tableau de Bord', es: '← Volver al Panel' },
  'selfcare.complaint_label': { pt: 'Queixa:', en: 'Complaint:', fr: 'Plainte :', es: 'Queja:' },

  /* ═══════════════════════════════════════════════════════════
     BOOK CONSULTATION MODAL
     ═══════════════════════════════════════════════════════════ */
  'booking.title': { pt: 'Marcar Consulta', en: 'Book Consultation', fr: 'Prendre Rendez-vous', es: 'Programar Consulta' },
  'booking.specialty': { pt: 'Especialidade', en: 'Specialty', fr: 'Spécialité', es: 'Especialidad' },
  'booking.specialty_select': { pt: 'Selecionar especialidade', en: 'Select specialty', fr: 'Sélectionner la spécialité', es: 'Seleccionar especialidad' },
  'booking.confirm': { pt: 'Confirmar Marcação', en: 'Confirm Booking', fr: 'Confirmer le Rendez-vous', es: 'Confirmar Cita' },
  'booking.confirming': { pt: 'A marcar…', en: 'Booking…', fr: 'Réservation…', es: 'Programando…' },
  'booking.cancel': { pt: 'Cancelar', en: 'Cancel', fr: 'Annuler', es: 'Cancelar' },
  'booking.success': { pt: 'Consulta marcada com sucesso!', en: 'Consultation booked successfully!', fr: 'Consultation réservée avec succès !', es: '¡Consulta programada con éxito!' },
  'booking.error': { pt: 'Erro ao marcar consulta.', en: 'Error booking consultation.', fr: 'Erreur lors de la réservation.', es: 'Error al programar la consulta.' },
  'booking.based_on': { pt: 'Com base na sua triagem:', en: 'Based on your triage:', fr: 'Selon votre triage :', es: 'Según tu triaje:' },
  'booking.risk_label': { pt: 'Risco', en: 'Risk', fr: 'Risque', es: 'Riesgo' },

  /* ═══════════════════════════════════════════════════════════
     MEDICATIONS & PRESCRIPTIONS
     ═══════════════════════════════════════════════════════════ */
  'meds.title': { pt: 'Medicações Actuais', en: 'Current Medications', fr: 'Médicaments Actuels', es: 'Medicaciones Actuales' },
  'meds.add': { pt: 'Adicionar Medicação', en: 'Add Medication', fr: 'Ajouter Médicament', es: 'Añadir Medicación' },
  'meds.none': { pt: 'Nenhuma medicação registada.', en: 'No medications registered.', fr: 'Aucun médicament enregistré.', es: 'Ninguna medicación registrada.' },
  'meds.none_hint': { pt: 'Adicione as suas medicações para que apareçam no autocuidado e triagem.', en: 'Add your medications to have them appear in self-care and triage.', fr: 'Ajoutez vos médicaments pour qu\'ils apparaissent dans les soins et le triage.', es: 'Añade tus medicaciones para que aparezcan en el autocuidado y el triaje.' },
  'meds.name': { pt: 'Nome do medicamento', en: 'Medication name', fr: 'Nom du médicament', es: 'Nombre del medicamento' },
  'meds.dosage': { pt: 'Dosagem (ex: 500mg)', en: 'Dosage (e.g.: 500mg)', fr: 'Posologie (ex : 500mg)', es: 'Dosis (ej: 500mg)' },
  'meds.frequency': { pt: 'Frequência (ex: 1×/dia)', en: 'Frequency (e.g.: 1×/day)', fr: 'Fréquence (ex : 1×/jour)', es: 'Frecuencia (ej: 1×/día)' },
  'meds.renew': { pt: 'Pedir Renovação', en: 'Request Renewal', fr: 'Demander Renouvellement', es: 'Solicitar Renovación' },
  'meds.renew_sent': { pt: 'Pedido enviado!', en: 'Request sent!', fr: 'Demande envoyée !', es: '¡Solicitud enviada!' },
  'meds.renew_error': { pt: 'Erro ao enviar pedido.', en: 'Error sending request.', fr: 'Erreur lors de l\'envoi.', es: 'Error al enviar la solicitud.' },
  'meds.remove': { pt: 'Remover', en: 'Remove', fr: 'Supprimer', es: 'Eliminar' },
  'meds.save': { pt: 'Guardar', en: 'Save', fr: 'Enregistrer', es: 'Guardar' },

  /* ═══════════════════════════════════════════════════════════
     FAMILY / DEPENDENTS
     ═══════════════════════════════════════════════════════════ */
  'family.title': { pt: 'Perfis Familiares', en: 'Family Profiles', fr: 'Profils Familiaux', es: 'Perfiles Familiares' },
  'family.subtitle': { pt: 'Gerir contas de menores e dependentes ligadas ao seu perfil', en: 'Manage minors and dependent accounts linked to your profile', fr: 'Gérer les mineurs et dépendants liés à votre profil', es: 'Gestiona las cuentas de menores y dependientes vinculadas a tu perfil' },
  'family.add': { pt: 'Adicionar Familiar', en: 'Add Family Member', fr: 'Ajouter Membre', es: 'Añadir Familiar' },
  'family.none': { pt: 'Nenhum perfil familiar registado.', en: 'No family profiles registered.', fr: 'Aucun profil familial enregistré.', es: 'Ningún perfil familiar registrado.' },
  'family.name': { pt: 'Nome completo', en: 'Full name', fr: 'Nom complet', es: 'Nombre completo' },
  'family.dob': { pt: 'Data de nascimento', en: 'Date of birth', fr: 'Date de naissance', es: 'Fecha de nacimiento' },
  'family.rel': { pt: 'Relação', en: 'Relationship', fr: 'Relation', es: 'Relación' },
  'family.rel_son': { pt: 'Filho', en: 'Son', fr: 'Fils', es: 'Hijo' },
  'family.rel_daughter': { pt: 'Filha', en: 'Daughter', fr: 'Fille', es: 'Hija' },
  'family.rel_other': { pt: 'Outro', en: 'Other', fr: 'Autre', es: 'Otro' },
  'family.minor_badge': { pt: 'Menor de 16 anos', en: 'Under 16', fr: 'Moins de 16 ans', es: 'Menor de 16 años' },
  'family.triage_for': { pt: 'Fazer Triagem', en: 'Start Triage', fr: 'Commencer Triage', es: 'Hacer Triaje' },
  'family.remove': { pt: 'Remover', en: 'Remove', fr: 'Supprimer', es: 'Eliminar' },
  'family.save': { pt: 'Guardar Familiar', en: 'Save Member', fr: 'Enregistrer Membre', es: 'Guardar Familiar' },
  'family.cancel_add': { pt: 'Cancelar', en: 'Cancel', fr: 'Annuler', es: 'Cancelar' },
  'family.minor_note': { pt: 'Perfil pediátrico — triagem com modo criança activa', en: 'Pediatric profile — triage in child mode', fr: 'Profil pédiatrique — triage en mode enfant', es: 'Perfil pediátrico — triaje en modo niño activado' },

  /* ═══════════════════════════════════════════════════════════
     VITALS & DEVICES (TRIAGE)
     ═══════════════════════════════════════════════════════════ */
  'vitals.title': { pt: 'Sinais Vitais (opcional)', en: 'Vital Signs (optional)', fr: 'Signes Vitaux (optionnel)', es: 'Signos Vitales (opcional)' },
  'vitals.manual': { pt: 'Inserção manual', en: 'Manual entry', fr: 'Saisie manuelle', es: 'Entrada manual' },
  'vitals.device': { pt: 'Ligar dispositivo', en: 'Connect device', fr: 'Connecter appareil', es: 'Conectar dispositivo' },
  'vitals.bp_sys': { pt: 'Tensão sistólica (mmHg)', en: 'Systolic BP (mmHg)', fr: 'Pression systolique (mmHg)', es: 'Presión sistólica (mmHg)' },
  'vitals.bp_dia': { pt: 'Tensão diastólica (mmHg)', en: 'Diastolic BP (mmHg)', fr: 'Pression diastolique (mmHg)', es: 'Presión diastólica (mmHg)' },
  'vitals.spo2': { pt: 'SpO₂ (%)', en: 'SpO₂ (%)', fr: 'SpO₂ (%)', es: 'SpO₂ (%)' },
  'vitals.temp': { pt: 'Temperatura (°C)', en: 'Temperature (°C)', fr: 'Température (°C)', es: 'Temperatura (°C)' },
  'vitals.glucose': { pt: 'Glicémia (mg/dL)', en: 'Blood Glucose (mg/dL)', fr: 'Glycémie (mg/dL)', es: 'Glucemia (mg/dL)' },
  'vitals.bt_scan': { pt: 'Procurar via Bluetooth', en: 'Scan via Bluetooth', fr: 'Scanner via Bluetooth', es: 'Buscar vía Bluetooth' },
  'vitals.bt_scanning': { pt: 'A procurar…', en: 'Scanning…', fr: 'Recherche…', es: 'Buscando…' },
  'vitals.wifi_label': { pt: 'IP do dispositivo (WiFi)', en: 'Device IP (WiFi)', fr: 'IP de l\'appareil (WiFi)', es: 'IP del dispositivo (WiFi)' },
  'vitals.connect': { pt: 'Ligar', en: 'Connect', fr: 'Connecter', es: 'Conectar' },
  'vitals.connected': { pt: 'Ligado', en: 'Connected', fr: 'Connecté', es: 'Conectado' },
  'vitals.read': { pt: 'Ler valores', en: 'Read values', fr: 'Lire les valeurs', es: 'Leer valores' },
  'vitals.not_supported': { pt: 'Bluetooth não disponível neste browser.', en: 'Bluetooth not available in this browser.', fr: 'Bluetooth non disponible dans ce navigateur.', es: 'Bluetooth no disponible en este navegador.' },

  /* TRIAGE — dependent selector */
  'triage.for_whom': { pt: 'Para quem é a triagem?', en: 'Who is this triage for?', fr: 'Pour qui est ce triage ?', es: '¿Para quién es este triaje?' },
  'triage.for_me': { pt: 'Para mim', en: 'For me', fr: 'Pour moi', es: 'Para mí' },
  'triage.for_dependent': { pt: 'Para um familiar', en: 'For a family member', fr: 'Pour un membre de la famille', es: 'Para un familiar' },
};

export default translations;
