import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export type AppLanguage = 'pt' | 'en' | 'fr' | 'es' | 'zh';

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
  'common.error': { pt: 'Erro', en: 'Error', fr: 'Erreur', es: 'Error', zh: '错误' },
  'common.back_login': { pt: 'Voltar ao login', en: 'Back to login', fr: 'Retour à la connexion', es: 'Volver al inicio de sesión', zh: '返回登录' },
  'landing.tagline': { pt: 'A tua saúde,\nmais simples.', en: 'Your health,\nmade simpler.', fr: 'Votre santé,\nplus simple.', es: 'Tu salud,\nmás sencilla.', zh: '让健康管理\n更简单。' },
  'landing.subtitle': { pt: 'Saúde para pacientes e profissionais · Angola', en: 'Healthcare for patients and professionals · Angola', fr: 'Santé pour patients et professionnels · Angola', es: 'Salud para pacientes y profesionales · Angola', zh: '面向患者和医护人员的健康平台 · 安哥拉' },
  'landing.login': { pt: 'Entrar no portal', en: 'Sign in to the portal', fr: 'Accéder au portail', es: 'Entrar al portal', zh: '登录平台' },
  'landing.register': { pt: 'Criar conta gratuita', en: 'Create a free account', fr: 'Créer un compte gratuit', es: 'Crear una cuenta gratuita', zh: '免费注册' },
  'landing.services_link': { pt: 'Conhecer os serviços →', en: 'Explore our services →', fr: 'Découvrir les services →', es: 'Conocer los servicios →', zh: '了解我们的服务 →' },
  'landing.services': { pt: 'Serviços', en: 'Services', fr: 'Services', es: 'Servicios', zh: '服务' },
  'landing.contacts': { pt: 'Contactos', en: 'Contact', fr: 'Contacts', es: 'Contactos', zh: '联系我们' },
  'landing.help': { pt: 'Ajuda e orientação', en: 'Help and guidance', fr: 'Aide et orientation', es: 'Ayuda y orientación', zh: '帮助与指导' },
  'landing.services_title': { pt: 'Serviços para pacientes e profissionais', en: 'Services for patients and professionals', fr: 'Services pour patients et professionnels', es: 'Servicios para pacientes y profesionales', zh: '患者与医护人员服务' },
  'landing.book': { pt: 'Marcar consulta', en: 'Book a consultation', fr: 'Prendre rendez-vous', es: 'Reservar consulta', zh: '预约问诊' },
  'landing.book_desc': { pt: 'Encontre profissionais verificados e escolha um horário.', en: 'Find verified professionals and choose a suitable time.', fr: 'Trouvez des professionnels vérifiés et choisissez un horaire.', es: 'Encuentre profesionales verificados y elija un horario.', zh: '查找已认证的医护人员并选择合适时间。' },
  'landing.teleconsult': { pt: 'Teleconsulta', en: 'Teleconsultation', fr: 'Téléconsultation', es: 'Teleconsulta', zh: '远程问诊' },
  'landing.teleconsult_desc': { pt: 'Consulta segura por vídeo, onde estiver.', en: 'Secure video consultation wherever you are.', fr: 'Consultation vidéo sécurisée où que vous soyez.', es: 'Consulta segura por vídeo dondequiera que esté.', zh: '随时随地进行安全的视频问诊。' },
  'landing.prescriptions': { pt: 'Receitas e documentos', en: 'Prescriptions and documents', fr: 'Ordonnances et documents', es: 'Recetas y documentos', zh: '处方与医疗文件' },
  'landing.prescriptions_desc': { pt: 'Pedidos, receitas digitais e acompanhamento clínico.', en: 'Requests, digital prescriptions, and clinical follow-up.', fr: 'Demandes, ordonnances numériques et suivi clinique.', es: 'Solicitudes, recetas digitales y seguimiento clínico.', zh: '申请、电子处方及临床随访。' },
  'landing.medication': { pt: 'Medições e medicação', en: 'Measurements and medication', fr: 'Mesures et médicaments', es: 'Mediciones y medicación', zh: '健康测量与用药' },
  'landing.medication_desc': { pt: 'Registe sinais de saúde e organize a medicação.', en: 'Record health readings and organize medication.', fr: 'Enregistrez vos mesures et organisez vos médicaments.', es: 'Registre mediciones de salud y organice la medicación.', zh: '记录健康数据并管理用药。' },
  'landing.chronic': { pt: 'Cuidado crónico', en: 'Chronic care', fr: 'Soins chroniques', es: 'Atención crónica', zh: '慢病管理' },
  'landing.chronic_desc': { pt: 'Acompanhamento contínuo entre paciente e equipa clínica.', en: 'Continuous follow-up between patient and clinical team.', fr: 'Suivi continu entre patient et équipe clinique.', es: 'Seguimiento continuo entre paciente y equipo clínico.', zh: '患者与临床团队之间的持续随访。' },
  'landing.professional': { pt: 'Portal profissional', en: 'Professional portal', fr: 'Portail professionnel', es: 'Portal profesional', zh: '医护人员门户' },
  'landing.professional_desc': { pt: 'Verificação, agenda, pacientes e indicadores para médicos e enfermeiros.', en: 'Verification, schedules, patients, and indicators for doctors and nurses.', fr: 'Vérification, agenda, patients et indicateurs pour médecins et infirmiers.', es: 'Verificación, agenda, pacientes e indicadores para médicos y enfermeros.', zh: '为医生和护士提供资质认证、日程、患者管理和指标。' },
  'landing.start': { pt: 'Criar conta e começar', en: 'Create an account and start', fr: 'Créer un compte et commencer', es: 'Crear una cuenta y comenzar', zh: '注册并开始使用' },
  'landing.language': { pt: 'Idioma', en: 'Language', fr: 'Langue', es: 'Idioma', zh: '语言' },
  'landing.contact_title': { pt: 'Contactar a KAYA', en: 'Contact KAYA', fr: 'Contacter KAYA', es: 'Contactar con KAYA', zh: '联系 KAYA' },
  'landing.contact_desc': { pt: 'A equipa de suporte pode ajudar com acesso, registo profissional e utilização da plataforma.', en: 'Support can help with access, professional registration, and using the platform.', fr: 'Le support peut vous aider pour l’accès, l’inscription professionnelle et l’utilisation de la plateforme.', es: 'Soporte puede ayudar con acceso, registro profesional y uso de la plataforma.', zh: '支持团队可协助登录、医护人员注册和平台使用。' },
  'landing.email_support': { pt: 'Enviar email ao suporte', en: 'Email support', fr: 'Envoyer un e-mail au support', es: 'Enviar correo a soporte', zh: '发送邮件给支持团队' },
  'landing.guidance_title': { pt: 'Assistente de orientação KAYA', en: 'KAYA guidance assistant', fr: 'Assistant d’orientation KAYA', es: 'Asistente de orientación KAYA', zh: 'KAYA 指导助手' },
  'landing.guidance_desc': { pt: 'Pergunte como usar a plataforma ou qual serviço procurar. Não substitui um profissional de saúde.', en: 'Ask how to use the platform or which service to look for. It does not replace a healthcare professional.', fr: 'Demandez comment utiliser la plateforme ou quel service rechercher. Il ne remplace pas un professionnel de santé.', es: 'Pregunte cómo usar la plataforma o qué servicio buscar. No sustituye a un profesional sanitario.', zh: '可询问平台使用方法或应选择的服务，但不能替代专业医护人员。' },
  'landing.guidance_placeholder': { pt: 'Escreva a sua pergunta…', en: 'Type your question…', fr: 'Écrivez votre question…', es: 'Escriba su pregunta…', zh: '请输入您的问题…' },
  'landing.send': { pt: 'Enviar', en: 'Send', fr: 'Envoyer', es: 'Enviar', zh: '发送' },
  'landing.help_fallback': { pt: 'Não foi possível ligar ao assistente. Posso ainda ajudar: crie uma conta para triagem, consultas ou registo profissional.', en: 'The assistant is temporarily unavailable. You can still create an account for triage, consultations, or professional registration.', fr: 'L’assistant est temporairement indisponible. Vous pouvez créer un compte pour le triage, les consultations ou l’inscription professionnelle.', es: 'El asistente no está disponible temporalmente. Puede crear una cuenta para triaje, consultas o registro profesional.', zh: '指导助手暂时无法连接。您仍可注册账户以使用分诊、问诊或医护人员认证。' },
  'verification.title': { pt: 'Verificação profissional', en: 'Professional verification', fr: 'Vérification professionnelle', es: 'Verificación profesional', zh: '专业资质验证' },
  'verification.subtitle': { pt: 'As funções clínicas são desbloqueadas apenas após revisão humana autorizada.', en: 'Clinical features unlock only after an authorised human review.', fr: 'Les fonctions cliniques sont accessibles uniquement après une vérification humaine autorisée.', es: 'Las funciones clínicas se habilitan únicamente después de una revisión humana autorizada.', zh: '临床功能仅在授权人工审核后开放。' },
  'verification.evidence': { pt: 'DOCUMENTOS OBRIGATÓRIOS', en: 'REQUIRED EVIDENCE', fr: 'DOCUMENTS OBLIGATOIRES', es: 'DOCUMENTOS OBLIGATORIOS', zh: '必需文件' },
  'verification.automated': { pt: 'VERIFICAÇÃO AUTOMATIZADA', en: 'AUTOMATED VERIFICATION', fr: 'VÉRIFICATION AUTOMATISÉE', es: 'VERIFICACIÓN AUTOMATIZADA', zh: '自动验证' },
  'nurse.dashboard': { pt: 'Painel de Enfermagem', en: 'Nursing dashboard', fr: 'Tableau de bord infirmier', es: 'Panel de enfermería', zh: '护理工作台' },
  'nurse.kpi_queue': { pt: 'Na fila', en: 'In queue', fr: 'En file', es: 'En cola', zh: '排队中' },
  'nurse.kpi_urgent': { pt: 'Urgentes / alto risco', en: 'Urgent / high risk', fr: 'Urgents / risque élevé', es: 'Urgentes / alto riesgo', zh: '紧急／高风险' },
  'nurse.kpi_triages': { pt: 'Triagens hoje', en: 'Triages today', fr: 'Triages aujourd’hui', es: 'Triajes hoy', zh: '今日分诊' },
  'nurse.kpi_wait': { pt: 'Espera média', en: 'Average wait', fr: 'Attente moyenne', es: 'Espera media', zh: '平均等待时间' },
  'nurse.kpi_over_30': { pt: 'À espera há +30 min', en: 'Waiting over 30 min', fr: 'Attente de plus de 30 min', es: 'Esperando más de 30 min', zh: '等待超过30分钟' },
  'nurse.kpi_unclassified': { pt: 'Sem risco classificado', en: 'Risk not classified', fr: 'Risque non classé', es: 'Riesgo sin clasificar', zh: '风险未分类' },
  'nurse.recent': { pt: 'Pedidos recentes', en: 'Recent requests', fr: 'Demandes récentes', es: 'Solicitudes recientes', zh: '最近请求' },
  'nurse.empty': { pt: 'Sem pedidos na fila.', en: 'No requests in the queue.', fr: 'Aucune demande en file.', es: 'No hay solicitudes en cola.', zh: '队列中暂无请求。' },
  'nurse.longest_wait': { pt: 'Maior espera atual', en: 'Current longest wait', fr: 'Attente actuelle la plus longue', es: 'Mayor espera actual', zh: '当前最长等待时间' },
  'doctor.dashboard': { pt: 'Painel Médico', en: 'Doctor dashboard', fr: 'Tableau de bord médical', es: 'Panel médico', zh: '医生工作台' },
  'doctor.today': { pt: 'Consultas hoje', en: 'Consultations today', fr: 'Consultations aujourd’hui', es: 'Consultas hoy', zh: '今日问诊' },
  'doctor.waiting': { pt: 'Na fila', en: 'In queue', fr: 'En file', es: 'En cola', zh: '排队中' },
  'doctor.active': { pt: 'Em atendimento', en: 'In progress', fr: 'En cours', es: 'En curso', zh: '进行中' },
  'doctor.prescriptions': { pt: 'Receitas pendentes', en: 'Pending prescriptions', fr: 'Ordonnances en attente', es: 'Recetas pendientes', zh: '待处理处方' },
  'doctor.week': { pt: 'Concluídas esta semana', en: 'Completed this week', fr: 'Terminées cette semaine', es: 'Completadas esta semana', zh: '本周已完成' },
  'doctor.patients': { pt: 'Pacientes acompanhados', en: 'Patients followed', fr: 'Patients suivis', es: 'Pacientes seguidos', zh: '已随访患者' },
  'doctor.coordination': { pt: 'COORDENAÇÃO CLÍNICA', en: 'CLINICAL COORDINATION', fr: 'COORDINATION CLINIQUE', es: 'COORDINACIÓN CLÍNICA', zh: '临床协作' },
  'doctor.escalations': { pt: 'Encaminhamentos da enfermagem', en: 'Nursing escalations', fr: 'Transmissions infirmières', es: 'Derivaciones de enfermería', zh: '护理转诊' },
  'doctor.no_escalations': { pt: 'Sem novos encaminhamentos.', en: 'No new escalations.', fr: 'Aucune nouvelle transmission.', es: 'Sin nuevas derivaciones.', zh: '暂无新转诊。' },
  'doctor.accept_open': { pt: 'Aceitar e abrir Patient 360', en: 'Accept and open Patient 360', fr: 'Accepter et ouvrir Patient 360', es: 'Aceptar y abrir Patient 360', zh: '接收并打开患者360' },
  'doctor.operations': { pt: 'OPERAÇÕES', en: 'OPERATIONS', fr: 'OPÉRATIONS', es: 'OPERACIONES', zh: '运营' },
  'doctor.queue': { pt: 'Fila clínica', en: 'Clinical queue', fr: 'File clinique', es: 'Cola clínica', zh: '临床队列' },
  'doctor.no_queue': { pt: 'Sem pacientes na fila.', en: 'No patients in the queue.', fr: 'Aucun patient dans la file.', es: 'No hay pacientes en la cola.', zh: '队列中暂无患者。' },
  'clinician.patient360': { pt: 'Visão clínica 360°', en: '360° clinical view', fr: 'Vue clinique 360°', es: 'Vista clínica 360°', zh: '360°临床视图' },
  'clinician.patient': { pt: 'Paciente', en: 'Patient', fr: 'Patient', es: 'Paciente', zh: '患者' },
  'clinician.doctor': { pt: 'Médico', en: 'Doctor', fr: 'Médecin', es: 'Médico', zh: '医生' },
  'clinician.nurse': { pt: 'Enfermagem', en: 'Nursing', fr: 'Soins infirmiers', es: 'Enfermería', zh: '护理' },
  'clinician.safety': { pt: 'Segurança clínica', en: 'Clinical safety', fr: 'Sécurité clinique', es: 'Seguridad clínica', zh: '临床安全' },
  'clinician.allergies': { pt: 'Alergias', en: 'Allergies', fr: 'Allergies', es: 'Alergias', zh: '过敏' },
  'clinician.risk': { pt: 'Risco atual', en: 'Current risk', fr: 'Risque actuel', es: 'Riesgo actual', zh: '当前风险' },
  'clinician.episode': { pt: 'Episódio ativo', en: 'Active episode', fr: 'Épisode actif', es: 'Episodio activo', zh: '当前护理事件' },
  'clinician.readings': { pt: 'Medições e dispositivos', en: 'Measurements and devices', fr: 'Mesures et appareils', es: 'Mediciones y dispositivos', zh: '测量与设备' },
  'clinician.medication': { pt: 'Medicação atual', en: 'Current medication', fr: 'Traitement actuel', es: 'Medicación actual', zh: '当前用药' },
  'clinician.consultations': { pt: 'Histórico de consultas', en: 'Consultation history', fr: 'Historique des consultations', es: 'Historial de consultas', zh: '问诊记录' },
  'clinician.no_data': { pt: 'Sem informação registada', en: 'No information recorded', fr: 'Aucune information enregistrée', es: 'Sin información registrada', zh: '暂无记录' },
  'clinician.load_error': { pt: 'Não foi possível carregar a informação clínica.', en: 'Clinical information could not be loaded.', fr: 'Impossible de charger les informations cliniques.', es: 'No se pudo cargar la información clínica.', zh: '无法加载临床信息。' },
  'clinician.accept_error': { pt: 'Não foi possível aceitar este episódio.', en: 'This episode could not be accepted.', fr: 'Impossible d’accepter cet épisode.', es: 'No se pudo aceptar este episodio.', zh: '无法接收此护理事件。' },
  'clinician.nurse_boundary': { pt: 'A enfermagem pode observar, documentar e encaminhar. Diagnóstico e prescrição permanecem sob responsabilidade médica.', en: 'Nursing can observe, document, and escalate. Diagnosis and prescribing remain the doctor’s responsibility.', fr: 'Les soins infirmiers peuvent observer, documenter et transmettre. Le diagnostic et la prescription relèvent du médecin.', es: 'Enfermería puede observar, documentar y derivar. El diagnóstico y la prescripción corresponden al médico.', zh: '护理人员可观察、记录和上报；诊断及处方由医生负责。' },
  'clinician.doctor_boundary': { pt: 'As decisões clínicas devem ser documentadas no episódio e respeitar a jurisdição e os consentimentos do paciente.', en: 'Clinical decisions must be documented in the episode and respect jurisdiction and patient consent.', fr: 'Les décisions cliniques doivent être documentées et respecter la juridiction et les consentements du patient.', es: 'Las decisiones clínicas deben documentarse y respetar la jurisdicción y los consentimientos del paciente.', zh: '临床决策必须记录在护理事件中，并遵守司法管辖和患者同意。' },
  'clinician.escalate': { pt: 'Encaminhar ao médico', en: 'Escalate to doctor', fr: 'Transmettre au médecin', es: 'Derivar al médico', zh: '转交医生' },
  'clinician.priority': { pt: 'Prioridade', en: 'Priority', fr: 'Priorité', es: 'Prioridad', zh: '优先级' },
  'clinician.priority_routine': { pt: 'Rotina', en: 'Routine', fr: 'Routine', es: 'Rutina', zh: '常规' },
  'clinician.priority_priority': { pt: 'Prioritário', en: 'Priority', fr: 'Prioritaire', es: 'Prioritario', zh: '优先' },
  'clinician.priority_urgent': { pt: 'Urgente', en: 'Urgent', fr: 'Urgent', es: 'Urgente', zh: '紧急' },
  'clinician.priority_emergency': { pt: 'Emergência', en: 'Emergency', fr: 'Urgence vitale', es: 'Emergencia', zh: '急救' },
  'clinician.reason': { pt: 'Motivo do encaminhamento', en: 'Reason for escalation', fr: 'Motif de la transmission', es: 'Motivo de derivación', zh: '转诊原因' },
  'clinician.handoff': { pt: 'Passagem clínica estruturada', en: 'Structured clinical handoff', fr: 'Transmission clinique structurée', es: 'Relevo clínico estructurado', zh: '结构化临床交接' },
  'clinician.send_doctor': { pt: 'Enviar ao médico', en: 'Send to doctor', fr: 'Envoyer au médecin', es: 'Enviar al médico', zh: '发送给医生' },
  'clinician.close': { pt: 'Fechar encaminhamento', en: 'Close escalation', fr: 'Fermer la transmission', es: 'Cerrar derivación', zh: '关闭转诊' },
  'clinician.situation': { pt: 'Situação', en: 'Situation', fr: 'Situation', es: 'Situación', zh: '情况' },
  'clinician.recommendation': { pt: 'Recomendação', en: 'Recommendation', fr: 'Recommandation', es: 'Recomendación', zh: '建议' },
  'clinician.sent_title': { pt: 'Encaminhamento enviado', en: 'Escalation sent', fr: 'Transmission envoyée', es: 'Derivación enviada', zh: '转诊已发送' },
  'clinician.sent_message': { pt: 'O episódio entrou na fila médica com a passagem clínica.', en: 'The episode entered the doctor queue with the clinical handoff.', fr: 'L’épisode a été ajouté à la file médicale avec la transmission clinique.', es: 'El episodio entró en la cola médica con el relevo clínico.', zh: '护理事件及临床交接已进入医生队列。' },
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
  'readings.title': { pt: 'Medições', en: 'Measurements', fr: 'Mesures', es: 'Mediciones' },
  'readings.add': { pt: 'Adicionar', en: 'Add', fr: 'Ajouter', es: 'Añadir' },
  'readings.cancel': { pt: 'Cancelar', en: 'Cancel', fr: 'Annuler', es: 'Cancelar' },
  'readings.empty': { pt: 'Ainda não existem medições.', en: 'No measurements yet.', fr: 'Aucune mesure pour le moment.', es: 'Aún no hay mediciones.' },
  'readings.save': { pt: 'Guardar medição', en: 'Save measurement', fr: 'Enregistrer la mesure', es: 'Guardar medición' },
  'readings.health_title': { pt: 'Sincronização automática', en: 'Automatic synchronization', fr: 'Synchronisation automatique', es: 'Sincronización automática' },
  'readings.health_desc': { pt: 'Importa peso e composição corporal autorizados pelo sistema de saúde do telefone.', en: 'Imports authorized weight and body-composition measurements from your phone’s health system.', fr: 'Importe les mesures autorisées de poids et de composition corporelle du téléphone.', es: 'Importa las mediciones autorizadas de peso y composición corporal del teléfono.' },
  'readings.connect': { pt: 'Ligar', en: 'Connect', fr: 'Connecter', es: 'Conectar' },
  'readings.disconnect': { pt: 'Desligar', en: 'Disconnect', fr: 'Déconnecter', es: 'Desconectar' },
  'readings.sync': { pt: 'Sincronizar agora', en: 'Sync now', fr: 'Synchroniser', es: 'Sincronizar ahora' },
  'readings.connected': { pt: 'Ligado', en: 'Connected', fr: 'Connecté', es: 'Conectado' },
  'readings.unavailable': { pt: 'Não disponível neste dispositivo', en: 'Not available on this device', fr: 'Indisponible sur cet appareil', es: 'No disponible en este dispositivo' },
  'readings.last_sync': { pt: 'Última sincronização', en: 'Last synchronization', fr: 'Dernière synchronisation', es: 'Última sincronización' },
  'readings.permission_denied': { pt: 'Autorize as medições nas definições de saúde do telefone.', en: 'Authorize measurements in the phone’s health settings.', fr: 'Autorisez les mesures dans les réglages de santé du téléphone.', es: 'Autoriza las mediciones en los ajustes de salud del teléfono.' },
  'readings.sync_complete': { pt: 'Medições atualizadas', en: 'Measurements updated', fr: 'Mesures mises à jour', es: 'Mediciones actualizadas' },
} as const;

type TranslationKey = keyof typeof translations;
type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void; t: (key: TranslationKey) => string };

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'kaya_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('pt');

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then(value => {
      if (value === 'pt' || value === 'en' || value === 'fr' || value === 'es' || value === 'zh') setLanguageState(value);
    }).catch(() => {});
  }, []);

  const setLanguage = (next: AppLanguage) => {
    setLanguageState(next);
    void SecureStore.setItemAsync(STORAGE_KEY, next);
  };
  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key: TranslationKey) => {
      const entry = translations[key] as Partial<Record<AppLanguage, string>>;
      return entry?.[language] || entry?.en || entry?.pt || key;
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used within LanguageProvider');
  return value;
}
