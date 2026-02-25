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
    pt: 'Gestão de doenças crónicas, prescrições digitais e acesso a mais de 20 especialidades médicas disponíveis em Angola — tudo num portal seguro, 24/7.',
    en: 'Chronic disease management, digital prescriptions and access to 20+ medical specialties available in Angola — all in one secure portal, 24/7.',
    fr: 'Gestion des maladies chroniques, prescriptions numériques et accès à plus de 20 spécialités médicales disponibles en Angola — le tout sur un portail sécurisé, 24/7.',
  },
  'landing.enter': { pt: 'Aceder ao Portal', en: 'Access Portal', fr: 'Accéder au Portail' },
  'landing.discover_services': { pt: 'Conhecer Serviços', en: 'Explore Services', fr: 'Découvrir les Services' },
  'landing.stat_patients': { pt: 'Pacientes Ativos', en: 'Active Patients', fr: 'Patients Actifs' },
  'landing.stat_doctors': { pt: 'Especialistas', en: 'Specialists', fr: 'Spécialistes' },
  'landing.stat_satisfaction': { pt: 'Satisfação', en: 'Satisfaction', fr: 'Satisfaction' },
  'landing.stat_available': { pt: 'Especialidades', en: 'Specialties', fr: 'Spécialités' },

  'landing.highlights_title': { pt: 'Como funciona', en: 'How It Works', fr: 'Comment ça marche' },
  'landing.highlights_subtitle': { pt: 'Três passos para cuidar da sua saúde em Angola', en: 'Three steps to take care of your health in Angola', fr: 'Trois étapes pour prendre soin de votre santé en Angola' },
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

  'landing.trust_title': { pt: 'Confiado por quem mais importa', en: 'Trusted by those who matter most', fr: 'Approuvé par ceux qui comptent le plus' },
  'landing.testimonial1': {
    pt: '"Tenho drepanocitose e a plataforma ajuda-me a gerir crises, receber prescrições de hidroxiureia e falar com o meu hematologista sem ir ao hospital."',
    en: '"I have sickle cell disease and the platform helps me manage crises, receive hydroxyurea prescriptions and talk to my hematologist without going to the hospital."',
    fr: '"J\'ai la drépanocytose et la plateforme m\'aide à gérer les crises, recevoir des prescriptions d\'hydroxyurée et parler à mon hématologue sans aller à l\'hôpital."',
  },
  'landing.testimonial1_author': { pt: 'Maria K., Paciente — Luanda', en: 'Maria K., Patient — Luanda', fr: 'Maria K., Patiente — Luanda' },
  'landing.testimonial2': {
    pt: '"Prescrevo digitalmente, acompanho doentes crónicos em tempo real e tenho acesso ao histórico completo. Revolucionou a minha prática na Clínica Girassol."',
    en: '"I prescribe digitally, monitor chronic patients in real time and have access to complete histories. It revolutionized my practice at Clínica Girassol."',
    fr: '"Je prescris numériquement, je surveille les patients chroniques en temps réel et j\'ai accès aux historiques complets. Cela a révolutionné ma pratique à la Clinique Girassol."',
  },
  'landing.testimonial2_author': { pt: 'Dr. João M., Cardiologista — Luanda', en: 'Dr. João M., Cardiologist — Luanda', fr: 'Dr. João M., Cardiologue — Luanda' },
  'landing.testimonial3': {
    pt: '"Em Benguela, o acesso a especialistas é limitado. Com a teleconsulta, consegui uma prescrição do pneumologista sem viajar até Luanda."',
    en: '"In Benguela, access to specialists is limited. With teleconsultation, I got a pulmonologist prescription without traveling to Luanda."',
    fr: '"À Benguela, l\'accès aux spécialistes est limité. Avec la téléconsultation, j\'ai obtenu une ordonnance du pneumologue sans voyager à Luanda."',
  },
  'landing.testimonial3_author': { pt: 'Teresa A., Paciente — Benguela', en: 'Teresa A., Patient — Benguela', fr: 'Teresa A., Patiente — Benguela' },

  'landing.cta_title': { pt: 'Cuide da sua saúde em Angola — comece hoje', en: 'Take care of your health in Angola — start today', fr: 'Prenez soin de votre santé en Angola — commencez aujourd\'hui' },
  'landing.cta_desc': { pt: 'Prescrições digitais, 20+ especialidades e acompanhamento de malária, drepanocitose, VIH e tuberculose — registe-se gratuitamente.', en: 'Digital prescriptions, 20+ specialties and malaria, sickle cell, HIV and tuberculosis follow-up — register for free.', fr: 'Prescriptions numériques, 20+ spécialités et suivi du paludisme, de la drépanocytose, du VIH et de la tuberculose — inscrivez-vous gratuitement.' },
  'landing.create_free': { pt: 'Criar Conta Grátis', en: 'Create Free Account', fr: 'Créer un Compte Gratuit' },
  'landing.have_account': { pt: 'Já tenho conta', en: 'I have an account', fr: 'J\'ai un compte' },
  'landing.emergency_112': { pt: 'Emergências Angola', en: 'Emergencies Angola', fr: 'Urgences Angola' },
  'landing.emergency_061': { pt: 'SOS Médico', en: 'SOS Doctor', fr: 'SOS Médecin' },

  /* ── Landing — Specialties Strip (Angola — Clínica Girassol / CSE) ── */
  'landing.specialties_title': { pt: 'Especialidades Disponíveis em Angola', en: 'Specialties Available in Angola', fr: 'Spécialités Disponibles en Angola' },
  'landing.specialties_subtitle': { pt: 'Aceda a especialistas de referência — Luanda, Benguela, Cabinda e mais', en: 'Access leading specialists — Luanda, Benguela, Cabinda and more', fr: 'Accédez à des spécialistes de référence — Luanda, Benguela, Cabinda et plus' },
  'landing.spec_cardiology': { pt: 'Cardiologia', en: 'Cardiology', fr: 'Cardiologie' },
  'landing.spec_endocrinology': { pt: 'Medicina Interna', en: 'Internal Medicine', fr: 'Médecine Interne' },
  'landing.spec_pulmonology': { pt: 'Infecciologia', en: 'Infectious Diseases', fr: 'Infectiologie' },
  'landing.spec_dermatology': { pt: 'Hematologia', en: 'Hematology', fr: 'Hématologie' },
  'landing.spec_neurology': { pt: 'Pneumologia', en: 'Pulmonology', fr: 'Pneumologie' },
  'landing.spec_orthopedics': { pt: 'Gastroenterologia', en: 'Gastroenterology', fr: 'Gastroentérologie' },
  'landing.spec_psychiatry': { pt: 'Nefrologia', en: 'Nephrology', fr: 'Néphrologie' },
  'landing.spec_general': { pt: 'Oncologia', en: 'Oncology', fr: 'Oncologie' },
  'landing.spec_more': { pt: '+12 especialidades', en: '+12 specialties', fr: '+12 spécialités' },

  /* ── Landing — Chronic Diseases Banner (Angola context) ── */
  'landing.chronic_title': { pt: 'Doenças Prevalentes em Angola', en: 'Prevalent Diseases in Angola', fr: 'Maladies Prévalentes en Angola' },
  'landing.chronic_subtitle': { pt: 'Acompanhamento contínuo para as doenças que mais afetam os angolanos', en: 'Continuous care for the diseases that most affect Angolans', fr: 'Suivi continu pour les maladies qui affectent le plus les Angolais' },
  'landing.chronic_diabetes': { pt: 'Malária', en: 'Malaria', fr: 'Paludisme' },
  'landing.chronic_diabetes_desc': { pt: 'Diagnóstico rápido, prescrição de antimaláricos e acompanhamento pós-tratamento com infecciologistas.', en: 'Rapid diagnosis, antimalarial prescriptions and post-treatment follow-up with infectious disease specialists.', fr: 'Diagnostic rapide, prescription d\'antipaludiques et suivi post-traitement avec des infectiologues.' },
  'landing.chronic_hypertension': { pt: 'Drepanocitose', en: 'Sickle Cell Disease', fr: 'Drépanocytose' },
  'landing.chronic_hypertension_desc': { pt: 'Gestão de crises vaso-oclusivas, prescrição de hidroxiureia e acompanhamento com hematologia.', en: 'Vaso-occlusive crisis management, hydroxyurea prescriptions and hematology follow-up.', fr: 'Gestion des crises vaso-occlusives, prescription d\'hydroxyurée et suivi en hématologie.' },
  'landing.chronic_asthma': { pt: 'VIH/SIDA', en: 'HIV/AIDS', fr: 'VIH/SIDA' },
  'landing.chronic_asthma_desc': { pt: 'Terapia antirretroviral, monitorização de carga viral e acompanhamento com infecciologistas — com total privacidade.', en: 'Antiretroviral therapy, viral load monitoring and infectious disease follow-up — with total privacy.', fr: 'Thérapie antirétrovirale, surveillance de la charge virale et suivi en infectiologie — en toute confidentialité.' },
  'landing.chronic_mental': { pt: 'Tuberculose', en: 'Tuberculosis', fr: 'Tuberculose' },
  'landing.chronic_mental_desc': { pt: 'Programa DOTS digital, prescrição de tuberculostáticos e acompanhamento pneumológico durante todo o tratamento.', en: 'Digital DOTS program, tuberculostatic prescriptions and pulmonology follow-up throughout treatment.', fr: 'Programme DOTS numérique, prescription de tuberculostatiques et suivi pneumologique tout au long du traitement.' },

  /* ═══════════════════════════════════════════════════════════
     ABOUT PAGE (Sobre) — story, team, mission, timeline
     ═══════════════════════════════════════════════════════════ */
  'about.badge': { pt: 'A Nossa História', en: 'Our Story', fr: 'Notre Histoire' },
  'about.hero_title1': { pt: 'Quem', en: 'Who', fr: 'Qui' },
  'about.hero_title2': { pt: 'Somos Nós', en: 'We Are', fr: 'Sommes-Nous' },
  'about.hero_desc': {
    pt: 'Nascemos da convicção de que a tecnologia pode eliminar barreiras no acesso à saúde em Angola. Desde 2024, ligamos pacientes angolanos a especialistas com segurança, rapidez e humanidade.',
    en: 'We were born from the conviction that technology can eliminate barriers in healthcare access in Angola. Since 2024, we connect Angolan patients to specialists with safety, speed and humanity.',
    fr: 'Nous sommes nés de la conviction que la technologie peut éliminer les barrières dans l\'accès aux soins en Angola. Depuis 2024, nous connectons les patients angolais aux spécialistes avec sécurité, rapidité et humanité.',
  },
  'about.mission': { pt: 'A Nossa Missão', en: 'Our Mission', fr: 'Notre Mission' },
  'about.mission_desc': {
    pt: 'Democratizar o acesso a especialidades médicas em Angola — da infecciologia à hematologia — através de prescrições digitais, triagem inteligente e teleconsulta, mesmo nas províncias mais remotas.',
    en: 'Democratize access to medical specialties in Angola — from infectious diseases to hematology — through digital prescriptions, intelligent triage and teleconsultation, even in the most remote provinces.',
    fr: 'Démocratiser l\'accès aux spécialités médicales en Angola — de l\'infectiologie à l\'hématologie — grâce aux prescriptions numériques, au triage intelligent et à la téléconsultation, même dans les provinces les plus reculées.',
  },
  'about.vision': { pt: 'A Nossa Visão', en: 'Our Vision', fr: 'Notre Vision' },
  'about.vision_desc': {
    pt: 'Ser a plataforma de referência para a gestão de saúde digital em Angola e na África lusófona, com 20+ especialidades médicas, programas dedicados a malária, drepanocitose, VIH e tuberculose, e tecnologia de IA ao serviço do bem-estar do paciente angolano.',
    en: 'To be the leading platform for digital health management in Angola and Portuguese-speaking Africa, with 20+ medical specialties, dedicated programs for malaria, sickle cell disease, HIV and tuberculosis, and AI technology serving Angolan patient well-being.',
    fr: 'Être la plateforme de référence pour la gestion de la santé numérique en Angola et en Afrique lusophone, avec 20+ spécialités médicales, des programmes dédiés au paludisme, à la drépanocytose, au VIH et à la tuberculose, et l\'IA au service du bien-être des patients angolais.',
  },

  'about.timeline_title': { pt: 'O Nosso Percurso', en: 'Our Journey', fr: 'Notre Parcours' },
  'about.timeline_subtitle': { pt: 'Marcos que definem quem somos', en: 'Milestones that define who we are', fr: 'Jalons qui définissent qui nous sommes' },
  'about.timeline_2024_q1': { pt: 'Fundação da Health Platform Angola. Motor de triagem v1 adaptado às doenças prevalentes em Angola.', en: 'Health Platform Angola founded. Triage engine v1 adapted to prevalent diseases in Angola.', fr: 'Fondation de Health Platform Angola. Moteur de triage v1 adapté aux maladies prévalentes en Angola.' },
  'about.timeline_2024_q3': { pt: 'Lançamento da teleconsulta com Clínica Girassol e Sagrada Esperança. 50 especialistas de 8 áreas.', en: 'Teleconsultation launch with Clínica Girassol and Sagrada Esperança. 50 specialists from 8 areas.', fr: 'Lancement de la téléconsultation avec Clínica Girassol et Sagrada Esperança. 50 spécialistes de 8 domaines.' },
  'about.timeline_2025_q1': { pt: 'Prescrições digitais validadas pela ORMED. Programas de malária, drepanocitose e VIH. 500+ pacientes em Luanda e Benguela.', en: 'Digital prescriptions validated by ORMED. Malaria, sickle cell and HIV programs. 500+ patients in Luanda and Benguela.', fr: 'Prescriptions numériques validées par l\'ORMED. Programmes paludisme, drépanocytose et VIH. 500+ patients à Luanda et Benguela.' },
  'about.timeline_2025_q4': { pt: 'IA de triagem v2. 20+ especialidades. Expansão a Cabinda, Huíla e Huambo. Parceria com Hospital Américo Boavida.', en: 'Triage AI v2. 20+ specialties. Expansion to Cabinda, Huíla and Huambo. Partnership with Hospital Américo Boavida.', fr: 'IA de triage v2. 20+ spécialités. Expansion à Cabinda, Huíla et Huambo. Partenariat avec l\'Hôpital Américo Boavida.' },

  'about.team_title': { pt: 'A Equipa', en: 'The Team', fr: 'L\'Équipe' },
  'about.team_subtitle': { pt: 'Pessoas apaixonadas por saúde e tecnologia', en: 'People passionate about health and technology', fr: 'Des personnes passionnées par la santé et la technologie' },
  'about.team_dev': { pt: 'Engenharia & Produto', en: 'Engineering & Product', fr: 'Ingénierie & Produit' },
  'about.team_dev_desc': { pt: 'Equipa multidisciplinar de engenheiros, designers e product managers focados em criar a melhor experiência digital de saúde.', en: 'Multidisciplinary team of engineers, designers and product managers focused on creating the best digital health experience.', fr: 'Équipe multidisciplinaire d\'ingénieurs, designers et product managers focalisés sur la création de la meilleure expérience de santé numérique.' },
  'about.team_clinical': { pt: 'Conselho Clínico & Especialidades', en: 'Clinical Board & Specialties', fr: 'Conseil Clinique & Spécialités' },
  'about.team_clinical_desc': { pt: 'Cardiologistas, infecciologistas, hematologistas, pneumologistas e outros especialistas registados na ORMED que validam protocolos, supervisionam programas de malária e drepanocitose e garantem a qualidade das prescrições digitais.', en: 'Cardiologists, infectious disease specialists, hematologists, pulmonologists and other ORMED-registered specialists who validate protocols, supervise malaria and sickle cell programs and ensure digital prescription quality.', fr: 'Cardiologues, infectiologues, hématologues, pneumologues et autres spécialistes inscrits à l\'ORMED qui valident les protocoles, supervisent les programmes paludisme et drépanocytose et assurent la qualité des prescriptions numériques.' },
  'about.team_ops': { pt: 'Operações & Suporte', en: 'Operations & Support', fr: 'Opérations & Support' },
  'about.team_ops_desc': { pt: 'Equipa dedicada ao suporte de pacientes e médicos, disponível 24/7 para garantir a melhor experiência possível.', en: 'Team dedicated to patient and doctor support, available 24/7 to ensure the best possible experience.', fr: 'Équipe dédiée au support des patients et médecins, disponible 24h/24 pour assurer la meilleure expérience possible.' },

  'about.numbers_title': { pt: 'Em Números', en: 'By the Numbers', fr: 'En Chiffres' },
  'about.cta_title': { pt: 'Quer fazer parte desta missão?', en: 'Want to be part of this mission?', fr: 'Vous voulez faire partie de cette mission ?' },
  'about.cta_desc': { pt: 'Junte-se como paciente, médico ou parceiro. Estamos a construir o futuro da saúde digital em Angola.', en: 'Join as a patient, doctor or partner. We are building the future of digital health in Angola.', fr: 'Rejoignez-nous en tant que patient, médecin ou partenaire. Nous construisons le futur de la santé numérique en Angola.' },
  'about.create_account': { pt: 'Criar Conta', en: 'Create Account', fr: 'Créer un Compte' },

  /* ═══════════════════════════════════════════════════════════
     SERVICES PAGE (Serviços) — detailed service descriptions
     ═══════════════════════════════════════════════════════════ */
  'services.hero_title': { pt: 'Especialidades, Prescrições & Saúde em Angola', en: 'Specialties, Prescriptions & Health in Angola', fr: 'Spécialités, Prescriptions & Santé en Angola' },
  'services.hero_desc': {
    pt: 'Mais de 20 especialidades médicas disponíveis em Angola, prescrições digitais validadas pela ORMED e programas dedicados a malária, drepanocitose, VIH e tuberculose — tudo na mesma plataforma.',
    en: 'Over 20 medical specialties available in Angola, ORMED-validated digital prescriptions and dedicated programs for malaria, sickle cell disease, HIV and tuberculosis — all on one platform.',
    fr: 'Plus de 20 spécialités médicales disponibles en Angola, prescriptions numériques validées par l\'ORMED et programmes dédiés au paludisme, à la drépanocytose, au VIH et à la tuberculose — le tout sur une seule plateforme.',
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
    pt: 'Receitas médicas digitais validadas pela ORMED, enviadas à farmácia da sua escolha em Angola. Renovação automática para doenças crónicas e prevalentes, alertas de interações medicamentosas e historial completo de prescrições acessível 24/7.',
    en: 'ORMED-validated digital prescriptions sent to your chosen pharmacy in Angola. Automatic renewal for chronic and prevalent diseases, drug interaction alerts and complete prescription history accessible 24/7.',
    fr: 'Ordonnances numériques validées par l\'ORMED envoyées à la pharmacie de votre choix en Angola. Renouvellement automatique pour les maladies chroniques et prévalentes, alertes d\'interactions médicamenteuses et historique complet des prescriptions accessible 24/7.',
  },
  'services.followup_title': { pt: 'Doenças Crónicas', en: 'Chronic Diseases', fr: 'Maladies Chroniques' },
  'services.followup_desc': {
    pt: 'Programas de acompanhamento para malária, drepanocitose, VIH/SIDA, tuberculose, diabetes e hipertensão. Monitorização de sinais vitais, ajuste de medicação e consultas regulares com especialistas em Angola.',
    en: 'Follow-up programs for malaria, sickle cell disease, HIV/AIDS, tuberculosis, diabetes and hypertension. Vital signs monitoring, medication adjustments and regular consultations with specialists in Angola.',
    fr: 'Programmes de suivi pour le paludisme, la drépanocytose, le VIH/SIDA, la tuberculose, le diabète et l\'hypertension. Surveillance des signes vitaux, ajustement des médicaments et consultations régulières avec des spécialistes en Angola.',
  },
  'services.corporate_title': { pt: 'Saúde Corporativa', en: 'Corporate Health', fr: 'Santé d\'Entreprise' },
  'services.corporate_desc': {
    pt: 'Painel de saúde ocupacional para empresas. Gestão de colaboradores, relatórios de absentismo, campanhas de vacinação e check-ups periódicos — tudo centralizado.',
    en: 'Occupational health dashboard for companies. Employee management, absenteeism reports, vaccination campaigns and periodic check-ups — all centralized.',
    fr: 'Tableau de bord de santé au travail pour les entreprises. Gestion des employés, rapports d\'absentéisme, campagnes de vaccination et bilans périodiques — le tout centralisé.',
  },
  'services.emergency_title': { pt: 'Especialidades Médicas', en: 'Medical Specialties', fr: 'Spécialités Médicales' },
  'services.emergency_desc': {
    pt: 'Acesso a mais de 20 especialidades em Angola: cardiologia, medicina interna, infecciologia, hematologia, pneumologia, gastroenterologia, nefrologia, oncologia, dermatologia, neurologia e mais. Parceiros: Clínica Girassol, Sagrada Esperança, Hospital Américo Boavida.',
    en: 'Access to 20+ specialties in Angola: cardiology, internal medicine, infectious diseases, hematology, pulmonology, gastroenterology, nephrology, oncology, dermatology, neurology and more. Partners: Clínica Girassol, Sagrada Esperança, Hospital Américo Boavida.',
    fr: 'Accès à plus de 20 spécialités en Angola : cardiologie, médecine interne, infectiologie, hématologie, pneumologie, gastroentérologie, néphrologie, oncologie, dermatologie, neurologie et plus. Partenaires : Clínica Girassol, Sagrada Esperança, Hôpital Américo Boavida.',
  },

  'services.for_patients': { pt: 'Para Pacientes', en: 'For Patients', fr: 'Pour les Patients' },
  'services.for_patients_desc': { pt: 'Gestão de malária, drepanocitose, VIH e tuberculose, prescrições digitais automáticas, acesso a 20+ especialidades e teleconsulta — em Luanda, Benguela, Cabinda e todo o país.', en: 'Malaria, sickle cell, HIV and tuberculosis management, automatic digital prescriptions, access to 20+ specialties and teleconsultation — in Luanda, Benguela, Cabinda and across the country.', fr: 'Gestion du paludisme, de la drépanocytose, du VIH et de la tuberculose, prescriptions numériques automatiques, accès à 20+ spécialités et téléconsultation — à Luanda, Benguela, Cabinda et dans tout le pays.' },
  'services.for_doctors': { pt: 'Para Médicos', en: 'For Doctors', fr: 'Pour les Médecins' },
  'services.for_doctors_desc': { pt: 'Prescrição digital integrada e validada pela ORMED, painel de doentes crónicos, fila por especialidade e histórico clínico completo num só lugar.', en: 'Integrated ORMED-validated digital prescribing, chronic patient dashboard, specialty-based queue and complete clinical history in one place.', fr: 'Prescription numérique intégrée validée par l\'ORMED, tableau de bord des patients chroniques, file par spécialité et historique clinique complet en un seul endroit.' },
  'services.for_companies': { pt: 'Para Empresas', en: 'For Companies', fr: 'Pour les Entreprises' },
  'services.for_companies_desc': { pt: 'Programas de prevenção de doenças crónicas, check-ups por especialidade, prescrições corporativas e relatórios de saúde ocupacional.', en: 'Chronic disease prevention programs, specialty check-ups, corporate prescriptions and occupational health reports.', fr: 'Programmes de prévention des maladies chroniques, bilans par spécialité, prescriptions corporate et rapports de santé au travail.' },

  'services.pricing_title': { pt: 'Planos & Preços', en: 'Plans & Pricing', fr: 'Plans & Tarifs' },
  'services.pricing_subtitle': { pt: 'Escolha o plano ideal para si', en: 'Choose the ideal plan for you', fr: 'Choisissez le plan idéal pour vous' },
  'services.plan_free': { pt: 'Básico', en: 'Basic', fr: 'Basique' },
  'services.plan_free_price': { pt: 'Grátis', en: 'Free', fr: 'Gratuit' },
  'services.plan_free_f1': { pt: 'Triagem inteligente ilimitada', en: 'Unlimited smart triage', fr: 'Triage intelligent illimité' },
  'services.plan_free_f2': { pt: 'Historial de prescrições', en: 'Prescription history', fr: 'Historique des prescriptions' },
  'services.plan_free_f3': { pt: 'Lembretes de medicação', en: 'Medication reminders', fr: 'Rappels de médicaments' },
  'services.plan_pro': { pt: 'Profissional', en: 'Professional', fr: 'Professionnel' },
  'services.plan_pro_price': { pt: '4.900 Kz/mês', en: '4,900 Kz/mo', fr: '4 900 Kz/mois' },
  'services.plan_pro_f1': { pt: 'Tudo do Básico', en: 'Everything in Basic', fr: 'Tout du Basique' },
  'services.plan_pro_f2': { pt: '3 consultas com especialistas/mês', en: '3 specialist consultations/month', fr: '3 consultations spécialistes/mois' },
  'services.plan_pro_f3': { pt: 'Prescrições digitais ilimitadas', en: 'Unlimited digital prescriptions', fr: 'Prescriptions numériques illimitées' },
  'services.plan_pro_f4': { pt: 'Programa de doenças crónicas', en: 'Chronic disease program', fr: 'Programme maladies chroniques' },
  'services.plan_enterprise': { pt: 'Empresarial', en: 'Enterprise', fr: 'Entreprise' },
  'services.plan_enterprise_price': { pt: 'Sob consulta', en: 'Contact us', fr: 'Sur devis' },
  'services.plan_enterprise_f1': { pt: 'Tudo do Profissional', en: 'Everything in Professional', fr: 'Tout du Professionnel' },
  'services.plan_enterprise_f2': { pt: 'Consultas ilimitadas (todas as especialidades)', en: 'Unlimited consultations (all specialties)', fr: 'Consultations illimitées (toutes spécialités)' },
  'services.plan_enterprise_f3': { pt: 'Gestão de crónicos corporativa', en: 'Corporate chronic disease management', fr: 'Gestion corporate des maladies chroniques' },
  'services.plan_enterprise_f4': { pt: 'API, prescrições em massa & relatórios', en: 'API, bulk prescriptions & reports', fr: 'API, prescriptions en masse & rapports' },
  'services.select_plan': { pt: 'Selecionar', en: 'Select', fr: 'Sélectionner' },
  'services.contact_us': { pt: 'Contactar', en: 'Contact Us', fr: 'Nous Contacter' },
  'services.most_popular': { pt: 'Mais Popular', en: 'Most Popular', fr: 'Le Plus Populaire' },

  'services.faq_title': { pt: 'Perguntas Frequentes', en: 'Frequently Asked Questions', fr: 'Questions Fréquentes' },
  'services.faq1_q': { pt: 'As prescrições digitais têm validade legal?', en: 'Are digital prescriptions legally valid?', fr: 'Les prescriptions numériques sont-elles légalement valides ?' },
  'services.faq1_a': { pt: 'Sim. As prescrições são emitidas por médicos registados na Ordem dos Médicos de Angola (ORMED) e têm a mesma validade legal que as prescrições em papel. São enviadas directamente à farmácia da sua escolha em Angola.', en: 'Yes. Prescriptions are issued by doctors registered with the Ordem dos Médicos de Angola (ORMED) and have the same legal validity as paper prescriptions. They are sent directly to your pharmacy of choice in Angola.', fr: 'Oui. Les prescriptions sont émises par des médecins inscrits à l\'Ordem dos Médicos de Angola (ORMED) et ont la même validité légale que les prescriptions papier. Elles sont envoyées directement à la pharmacie de votre choix en Angola.' },
  'services.faq2_q': { pt: 'Que doenças crónicas são acompanhadas?', en: 'Which chronic diseases are covered?', fr: 'Quelles maladies chroniques sont suivies ?' },
  'services.faq2_a': { pt: 'Acompanhamos malária, drepanocitose (anemia falciforme), VIH/SIDA, tuberculose, diabetes (tipo 1 e 2), hipertensão arterial, asma e DPOC, entre outras. Cada programa inclui monitorização, prescrições automáticas e consultas regulares com especialistas em Angola.', en: 'We cover malaria, sickle cell disease, HIV/AIDS, tuberculosis, type 1 and 2 diabetes, arterial hypertension, asthma and COPD, among others. Each program includes monitoring, automatic prescriptions and regular specialist consultations in Angola.', fr: 'Nous couvrons le paludisme, la drépanocytose, le VIH/SIDA, la tuberculose, le diabète (type 1 et 2), l\'hypertension artérielle, l\'asthme et la BPCO, entre autres. Chaque programme comprend la surveillance, les prescriptions automatiques et les consultations régulières avec des spécialistes en Angola.' },
  'services.faq3_q': { pt: 'Que especialidades médicas estão disponíveis?', en: 'Which medical specialties are available?', fr: 'Quelles spécialités médicales sont disponibles ?' },
  'services.faq3_a': { pt: 'Contamos com mais de 20 especialidades em Angola: cardiologia, medicina interna, infecciologia, hematologia, pneumologia, gastroenterologia, nefrologia, oncologia, dermatologia, neurologia, endocrinologia, psiquiatria, geriatria e outras. Parcerias com Clínica Girassol, Sagrada Esperança e Hospital Américo Boavida.', en: 'We have 20+ specialties in Angola: cardiology, internal medicine, infectious diseases, hematology, pulmonology, gastroenterology, nephrology, oncology, dermatology, neurology, endocrinology, psychiatry, geriatrics and others. Partnerships with Clínica Girassol, Sagrada Esperança and Hospital Américo Boavida.', fr: 'Nous disposons de plus de 20 spécialités en Angola : cardiologie, médecine interne, infectiologie, hématologie, pneumologie, gastroentérologie, néphrologie, oncologie, dermatologie, neurologie, endocrinologie, psychiatrie, gériatrie et autres. Partenariats avec Clínica Girassol, Sagrada Esperança et Hôpital Américo Boavida.' },
  'services.faq4_q': { pt: 'Posso renovar prescrições de doenças crónicas automaticamente?', en: 'Can I automatically renew chronic disease prescriptions?', fr: 'Puis-je renouveler automatiquement les prescriptions de maladies chroniques ?' },
  'services.faq4_a': { pt: 'Sim. Com o plano Profissional ou Empresarial, prescrições de medicação crónica são renovadas automaticamente após validação pelo seu médico. Recebe notificações antes do fim de cada ciclo.', en: 'Yes. With the Professional or Enterprise plan, chronic medication prescriptions are automatically renewed after validation by your doctor. You receive notifications before each cycle ends.', fr: 'Oui. Avec le plan Professionnel ou Entreprise, les prescriptions de médicaments chroniques sont renouvelées automatiquement après validation par votre médecin. Vous recevez des notifications avant la fin de chaque cycle.' },
  'services.faq5_q': { pt: 'Posso usar a plataforma para a minha empresa?', en: 'Can I use the platform for my company?', fr: 'Puis-je utiliser la plateforme pour mon entreprise ?' },
  'services.faq5_a': { pt: 'Sim! O plano Empresarial inclui gestão de doenças crónicas dos colaboradores, prescrições corporativas, consultas com todas as especialidades e relatórios de saúde ocupacional.', en: 'Yes! The Enterprise plan includes employee chronic disease management, corporate prescriptions, consultations across all specialties and occupational health reports.', fr: 'Oui ! Le plan Entreprise comprend la gestion des maladies chroniques des employés, les prescriptions corporate, les consultations dans toutes les spécialités et les rapports de santé au travail.' },

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
