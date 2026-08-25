import React from 'react';
import { Redirect } from 'expo-router';

export default function NotFoundScreen() {
  return <Redirect href={{ pathname: '/error', params: { type: '404' } }} />;
}
