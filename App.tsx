import 'react-native-url-polyfill/auto';

import React from 'react';

import { AuthProvider } from './src/auth/AuthProvider';
import { Root } from './src/navigation/Root';
import { AppProviders } from './src/providers/AppProviders';

export default function App() {
  return (
    <AppProviders>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </AppProviders>
  );
}
