import { createApp } from 'vue';
import App from './ui/App.vue';
import { vExpoStep } from './ui/directives/expoStep.js';
import { vLimits } from './ui/directives/limits.js';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './style.css';

createApp(App)
  .directive('expo-step', vExpoStep)
  .directive('limits', vLimits)
  .mount('#app');
