// Constants and shared values for Doany app

export const Colors = {
  primary: '#3B82F6',      // Blue-500
  primaryDark: '#1E40AF',  // Blue-800
  success: '#10B981',      // Emerald-500
  warning: '#F59E0B',      // Amber-500
  danger: '#EF4444',       // Red-500
  background: '#F9FAFB',   // Gray-50
  surface: '#FFFFFF',      // White
  text: '#111827',         // Gray-900
  textSecondary: '#6B7280', // Gray-500
  border: '#E5E7EB',       // Gray-200
} as const;

export const Sizes = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

export const Categories = [
  'Health & Fitness',
  'Productivity',
  'Learning',
  'Social',
  'Finance',
  'Hobbies',
  'Family',
  'Career',
  'Spiritual',
  'Other'
] as const;

export const VerificationTypes = ['location', 'time', 'screentime', 'photo', 'manual'] as const;

export const VerificationTypeDetails = {
  location: {
    label: 'Location-based',
    description: 'Verify by checking your location at specific times',
    icon: 'location'
  },
  time: {
    label: 'Time-based',
    description: 'Verify by tracking specific time windows',
    icon: 'time'
  },
  screentime: {
    label: 'Screen Time',
    description: 'Track app usage and screen time limits',
    icon: 'phone-portrait'
  },
  photo: {
    label: 'Photo Proof',
    description: 'Take a photo as proof of completion',
    icon: 'camera'
  },
  manual: {
    label: 'Manual Check-in',
    description: 'Manually confirm when you complete the task',
    icon: 'checkmark-circle'
  }
} as const;

export const TimeFrames = [
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' }
] as const;
