import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Activity,
  LogOut,
} from 'lucide-react-native';
import { theme, rivio } from './src/theme/colors';
import { useHealthStore } from './src/store/useHealthStore';
import { AuthScreen } from './src/screens/AuthScreen';
import { PatientHubScreen } from './src/screens/PatientHubScreen';

function MainNavigation() {
  const { isAuthenticated, user, logout } = useHealthStore();
  const insets = useSafeAreaInsets();

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 10);
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? 28 : 0);

  // 1. Fluxo de Autenticação / Login
  if (!isAuthenticated) {
    return (
      <View style={[styles.safeArea, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <StatusBar style="dark" />
        <AuthScreen />
      </View>
    );
  }

  // 2. Aplicação com Tela Única e Direta: PatientHubScreen (com Popup do Token)
  return (
    <View style={[styles.safeArea, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <StatusBar style="dark" />

      {/* Barra Superior / Header Executivo Rivio */}
      <View style={styles.topAppBar}>
        <View style={styles.topLogoContainer}>
          <View style={styles.logoPill}>
            <Activity color={theme.colors.primary} size={16} />
          </View>
          <View style={styles.brandTitleWrap}>
            <Text style={styles.topAppBrand}>
              rivio<Text style={styles.topAppBrandDot}>.</Text>
            </Text>
            <Text style={styles.topAppSubtitle}>Saúde</Text>
          </View>
        </View>

        {/* Identidade do Usuário e Logout */}
        <View style={styles.topUserSection}>
          <View style={styles.userBadgePill}>
            <Text style={styles.userBadgeName} numberOfLines={1}>
              {user.name.split(' ')[0]}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.topLogoutButton}
            onPress={logout}
            accessibilityLabel="Encerrar sessão"
          >
            <LogOut color={theme.colors.textSecondary} size={15} />
            <Text style={styles.topLogoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Conteúdo da Tela: Hub com os 3 botões e o botão que abre o Popup do Token */}
      <View style={styles.screenContainer}>
        <PatientHubScreen />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainNavigation />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: rivio.surface.base,
  },
  topAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: rivio.surface.line,
  },
  topLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(8, 124, 115, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitleWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  topAppBrand: {
    fontSize: 18,
    fontWeight: '900',
    color: rivio.ink[900],
    letterSpacing: -0.5,
  },
  topAppBrandDot: {
    color: '#14A394',
  },
  topAppSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: rivio.brand[600],
  },
  topUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userBadgePill: {
    backgroundColor: 'rgba(8, 124, 115, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  userBadgeName: {
    fontSize: 11,
    fontWeight: '700',
    color: rivio.brand[700],
  },
  topLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  topLogoutText: {
    fontSize: 11,
    color: rivio.ink[600],
    fontWeight: '600',
  },
  screenContainer: {
    flex: 1,
  },
});
