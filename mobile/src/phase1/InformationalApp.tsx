import React from 'react';
import { ScrollView, View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { displayCapabilityState, displayState, policy } from './policy';

export default function InformationalApp() {
  return <SafeAreaProvider><InformationalContent /></SafeAreaProvider>;
}

function InformationalContent() {
  const location = `${policy.planning.city}, ${policy.planning.country_name ?? policy.planning.country_code}`;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f7f3" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand} accessibilityLabel="KAYA">KAYA.</Text>
          <Text style={styles.badge}>Information only</Text>
        </View>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>A CONSIDERED START</Text>
          <Text style={styles.title} accessibilityRole="header">{policy.public_copy.title}</Text>
          <Text style={styles.lead}>{policy.public_copy.planning_notice}</Text>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{policy.public_copy.availability}</Text>
            <Text style={styles.body}>Do not send personal or health information.</Text>
          </View>
        </View>
        <View style={styles.fact}>
          <Text style={styles.label}>Planning location</Text>
          <Text style={styles.factValue}>{location}</Text>
          <Text style={styles.detail}>Scope: {displayState(policy.planning.approval_scope)}.</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.label}>Release status</Text>
          <Text style={styles.factValue}>{displayState(policy.release.status)}</Text>
          <Text style={styles.detail}>{policy.release.approved_jurisdictions.length === 0
            ? 'No jurisdiction is approved for service access.'
            : 'This version remains information only.'}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.label}>Your jurisdiction</Text>
          <Text style={styles.factValue}>Unverified</Text>
          <Text style={styles.detail}>Language and device settings do not establish eligibility.</Text>
        </View>
        <View style={styles.capabilities}>
          <Text style={styles.eyebrow}>CURRENT CAPABILITY STATUS</Text>
          <Text style={styles.sectionTitle} accessibilityRole="header">What is available today</Text>
          <Text style={styles.body}>The states below describe the current project. They do not authorize care or participation.</Text>
          {policy.capabilities.map(capability => (
            <View key={capability.id} style={styles.capability}>
              <Text style={styles.capabilityLabel}>{capability.label}</Text>
              <Text style={styles.body}>Current state: {displayCapabilityState(capability.state)}</Text>
              <Text style={styles.detail}>Unavailable in this version</Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <Text style={styles.detail}>KAYA · {location}</Text>
          <Text style={styles.detail}>Planning approval does not authorize launch.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7f3' },
  page: { paddingHorizontal: 24, paddingBottom: 30, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: '#d7e1db' },
  brand: { fontSize: 29, fontWeight: '800', letterSpacing: -1.5, color: '#173b36' },
  badge: { fontSize: 12, fontWeight: '600', color: '#173b36', paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#b7c9bc', borderRadius: 24 },
  intro: { paddingTop: 36, paddingBottom: 30 },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, fontWeight: '700', color: '#486a57', marginBottom: 14 },
  title: { fontSize: 38, lineHeight: 43, fontWeight: '500', letterSpacing: -1.2, color: '#173b36', marginBottom: 18 },
  lead: { fontSize: 17, lineHeight: 26, color: '#53655b' },
  notice: { backgroundColor: '#eaf0e4', borderLeftWidth: 3, borderLeftColor: '#7d9064', marginTop: 24, padding: 17, gap: 6 },
  noticeTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#173b36' },
  body: { fontSize: 14, lineHeight: 22, color: '#53655b' },
  fact: { paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#d7e1db', gap: 6 },
  label: { fontSize: 12, color: '#53655b' },
  factValue: { fontSize: 20, fontWeight: '600', color: '#173b36', textTransform: 'capitalize' },
  detail: { fontSize: 12, lineHeight: 19, color: '#53655b' },
  capabilities: { marginTop: 30 },
  sectionTitle: { fontSize: 27, lineHeight: 34, fontWeight: '500', color: '#173b36', marginBottom: 12 },
  capability: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#d7e1db', gap: 6 },
  capabilityLabel: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#173b36' },
  footer: { marginTop: 32, gap: 5 },
});
