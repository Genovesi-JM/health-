import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, SafeAreaView, Modal, Linking, Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthStack';

const TEAL      = '#0d9488';
const TEAL_DARK = '#0a7a6e';
const TEAL_SOFT = '#ccfbf1';
const SLATE     = '#0f172a';
const MUTED     = '#64748b';

type Nav = NativeStackNavigationProp<AuthStackParamList>;

const MENU_ITEMS = [
  { label: 'Entrar',       action: 'login'    },
  { label: 'Criar conta',  action: 'register' },
  { label: 'Serviços',     action: 'services' },
  { label: 'Contactos',    action: 'contact'  },
  { label: 'Ajuda / FAQ',  action: 'faq'      },
];

const SERVICES = [
  { icon: '📅', label: 'Marcar consulta'  },
  { icon: '🖥',  label: 'Teleconsulta'    },
  { icon: '💊', label: 'Receitas'         },
  { icon: '🩺', label: 'Medicação'        },
  { icon: '❤',  label: 'Cuidado crónico' },
];

export default function LandingScreen() {
  const navigation = useNavigation<Nav>();
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  const handleMenu = (action: string) => {
    setMenuOpen(false);
    if      (action === 'login')    setTimeout(() => navigation.navigate('Login'),    50);
    else if (action === 'register') setTimeout(() => navigation.navigate('Register'), 50);
    else if (action === 'services') setTimeout(() => setServicesOpen(true),           50);
    else if (action === 'contact')  Linking.openURL('mailto:suporte@kaya.health');
    else if (action === 'faq')      Linking.openURL('https://kaya.health/faq');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={TEAL_DARK} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>
            KAYA <Text style={styles.logoSub}>Saúde</Text>
          </Text>
        </View>
        <TouchableOpacity
          style={styles.burgerBtn}
          onPress={() => setMenuOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <View style={styles.burgerLine} />
          <View style={[styles.burgerLine, { width: 18 }]} />
          <View style={styles.burgerLine} />
        </TouchableOpacity>
      </View>

      {/* Main centred content */}
      <View style={styles.body}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>K</Text>
        </View>
        <Text style={styles.tagline}>A tua saúde,{'\n'}mais simples.</Text>
        <Text style={styles.sub}>Portal do paciente · Angola</Text>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Entrar no portal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>Criar conta gratuita</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setServicesOpen(true)}
          activeOpacity={0.7}
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>Conhecer os serviços →</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:suporte@kaya.health')}
          activeOpacity={0.7}
        >
          <Text style={styles.footerText}>suporte@kaya.health</Text>
        </TouchableOpacity>
      </View>

      {/* Burger drawer */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.drawer}>
            <TouchableOpacity
              onPress={() => setMenuOpen(false)}
              style={styles.drawerClose}
            >
              <Text style={styles.drawerCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.drawerLogo}>KAYA Saúde</Text>
            {MENU_ITEMS.map(item => (
              <TouchableOpacity
                key={item.action}
                style={styles.drawerItem}
                onPress={() => handleMenu(item.action)}
                activeOpacity={0.75}
              >
                <Text style={[
                  styles.drawerItemText,
                  item.action === 'login' && styles.drawerItemPrimary,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Services sheet */}
      <Modal
        visible={servicesOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setServicesOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setServicesOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Os nossos serviços</Text>
            {SERVICES.map(s => (
              <View key={s.label} style={styles.serviceRow}>
                <Text style={styles.serviceIcon}>{s.icon}</Text>
                <Text style={styles.serviceLabel}>{s.label}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 20 }]}
              onPress={() => { setServicesOpen(false); navigation.navigate('Register'); }}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>Criar conta e começar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TEAL_DARK },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  logoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL_SOFT },
  logoText:  { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  logoSub:   { fontWeight: '400', color: 'rgba(255,255,255,0.75)' },
  burgerBtn: { padding: 4, gap: 5, alignItems: 'flex-end' },
  burgerLine:{ width: 24, height: 2, borderRadius: 2, backgroundColor: '#fff' },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  brandMark: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  brandMarkText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  tagline: {
    fontSize: 32, fontWeight: '800', color: '#fff',
    textAlign: 'center', lineHeight: 40, marginBottom: 10,
  },
  sub: {
    fontSize: 13, color: 'rgba(255,255,255,0.6)',
    textAlign: 'center', marginBottom: 40, letterSpacing: 0.3,
  },

  btnPrimary: {
    backgroundColor: '#fff',
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', width: '100%', marginBottom: 12,
  },
  btnPrimaryText:   { color: TEAL_DARK, fontSize: 16, fontWeight: '800' },
  btnSecondary: {
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', width: '100%',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 24,
  },
  btnSecondaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkBtn:          { paddingVertical: 4 },
  linkText:         { color: TEAL_SOFT, fontSize: 14, fontWeight: '600' },

  footer: { paddingBottom: 20, alignItems: 'center' },
  footerText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
  },

  drawer: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: '70%', backgroundColor: '#fff',
    paddingTop: 56, paddingHorizontal: 24,
  },
  drawerClose:       { position: 'absolute', top: 16, right: 16, padding: 8 },
  drawerCloseText:   { fontSize: 18, color: MUTED },
  drawerLogo:        { fontSize: 16, fontWeight: '800', color: SLATE, marginBottom: 28, letterSpacing: 0.5 },
  drawerItem:        { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  drawerItemText:    { fontSize: 16, color: SLATE, fontWeight: '500' },
  drawerItemPrimary: { color: TEAL, fontWeight: '700' },

  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle:   { fontSize: 18, fontWeight: '800', color: SLATE, marginBottom: 16 },
  serviceRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  serviceIcon:  { fontSize: 22 },
  serviceLabel: { fontSize: 15, fontWeight: '600', color: SLATE },
});
