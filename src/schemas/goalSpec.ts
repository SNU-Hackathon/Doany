import { z } from 'zod';

// Canonical JSON schema matching the AI prompt output
export const GoalSpecSchema = z.object({
  // New AI schema fields
  type: z.enum(['schedule', 'frequency', 'milestone']).optional(),
  originalText: z.string().min(1).optional(),
  
  schedule: z.object({
    events: z.array(
      z.object({
        dayOfWeek: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
        time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM'),
        locationName: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
    ).optional(),
    // Legacy fields for backward compatibility
    countRule: z.object({
      operator: z.enum(['>=', '==', '<=']),
      count: z.number(),
      unit: z.enum(['per_week', 'per_day', 'per_month']),
    }).optional(),
    weekdayConstraints: z.array(z.number()).optional(),
    timeRules: z.array(z.object({
      days: z.array(z.number()),
      range: z.tuple([z.string(), z.string()]),
      label: z.string().optional(),
      source: z.enum(['user_text', 'inferred']),
    })).optional(),
    timeWindows: z.array(z.object({
      label: z.string(),
      range: z.tuple([z.string(), z.string()]),
      source: z.enum(['user_text', 'inferred']),
    })).optional(),
    weekBoundary: z.enum(['startWeekday', 'isoWeek']).optional(),
    enforcePartialWeeks: z.boolean().optional(),
    requiresDisambiguation: z.boolean().optional(),
    followUpQuestion: z.string().optional(),
  }).optional(),
  
  frequency: z.object({
    targetPerWeek: z.number().int().positive('targetPerWeek must be a positive integer'),
    windowDays: z.number().int().positive().default(7),
  }).optional(),
  
  milestone: z.object({
    milestones: z.array(z.object({
      key: z.string(),
      label: z.string(),
      targetDate: z.string().optional(),
    })).optional(),
    totalDuration: z.number().optional(), // weeks
  }).optional(),
  
  verification: z.object({
    // New AI schema field
    signals: z.array(
      z.enum(['time', 'location', 'photo', 'manual'])
    ).min(1, 'At least one verification signal is required').optional(),
    // Legacy fields for backward compatibility
    methods: z.array(z.enum(['location', 'time', 'screentime', 'photo', 'manual'])).optional(),
    mandatory: z.array(z.enum(['location', 'time', 'screentime', 'photo', 'manual'])).optional(),
    constraints: z.object({
      location: z.object({
        mode: z.enum(['geofence', 'movement']).optional(),
        name: z.string().optional(),
        placeId: z.string().optional(),
        radiusM: z.number().optional(),
        minDwellMin: z.number().optional(),
        minDistanceKm: z.number().optional(),
        evidence: z.enum(['GPS', 'HealthKit', 'GoogleFit']).optional(),
      }).optional(),
      screentime: z.object({
        bundleIds: z.array(z.string()).optional(),
        category: z.string().optional(),
      }).optional(),
      photo: z.object({
        required: z.boolean().optional(),
      }).optional(),
    }).optional(),
    sufficiency: z.boolean().optional(),
    rationale: z.string().optional(),
  }),
  
  // Legacy fields for backward compatibility
  title: z.string().optional(),
  missingFields: z.array(z.string()).optional(),
  
  // Optional metadata for uncertainty handling
  meta: z.object({
    reason: z.string(),
  }).optional(),
}).strict(); // Reject unknown keys

// Type inference from schema
export type GoalSpec = z.infer<typeof GoalSpecSchema>;

// Validation function with error handling
export function validateGoalSpec(data: unknown): GoalSpec {
  try {
    return GoalSpecSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Handle different Zod versions - some have errors property, others have issues
      const issues = error.issues || [];
      if (Array.isArray(issues) && issues.length > 0) {
        const errorMessages = issues.map(err => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        }).join(', ');
        
        throw new Error(`Goal specification validation failed: ${errorMessages}`);
      } else {
        // Fallback to the error message itself
        throw new Error(`Goal specification validation failed: ${error.message}`);
      }
    }
    throw new Error(`Unknown validation error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Recover function for partial validation
export function validateGoalSpecWithRecovery(data: unknown): {
  spec: GoalSpec | null;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    const spec = GoalSpecSchema.parse(data);
    return { spec, warnings, errors };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Handle different Zod versions
      const issues = error.issues || [];
      
      // Try to recover by fixing common issues
      const recovered = attemptRecovery(data, issues);
      
      if (recovered.spec) {
        warnings.push(...recovered.warnings);
        return recovered;
      } else {
        // Format errors for user
        if (Array.isArray(issues) && issues.length > 0) {
          issues.forEach(err => {
            const path = err.path.join('.');
            errors.push(`${path}: ${err.message}`);
          });
        } else {
          errors.push('Validation failed with unknown error structure');
        }
        return { spec: null, warnings, errors };
      }
    }
    errors.push('Unknown validation error');
    return { spec: null, warnings, errors };
  }
}

// Recovery function for common validation issues
function attemptRecovery(data: any, errors: z.ZodIssue[]): {
  spec: GoalSpec | null;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const recovered = { ...data };
  
  try {
    // Fix common issues
    for (const error of errors) {
      const path = error.path.join('.');
      
      // Fix missing required fields with defaults
      if (path === 'type' && !recovered.type) {
        recovered.type = 'frequency'; // Default fallback
        warnings.push('Missing goal type, defaulting to frequency');
      }
      
      if (path === 'originalText' && !recovered.originalText) {
        recovered.originalText = recovered.title || 'Untitled goal';
        warnings.push('Missing originalText, using title as fallback');
      }
      
      if (path === 'verification.signals' && !recovered.verification?.signals) {
        recovered.verification = { ...recovered.verification, signals: ['manual'] };
        warnings.push('Missing verification signals, defaulting to manual');
      }
      
      // Fix invalid time formats
      if (path.includes('time') && recovered.schedule?.events && Array.isArray(recovered.schedule.events)) {
        recovered.schedule.events = recovered.schedule.events.map((event: any) => {
          if (event.time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(event.time)) {
            warnings.push(`Invalid time format "${event.time}", attempting to fix`);
            // Try to parse and reformat
            const timeMatch = event.time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
            if (timeMatch) {
              let hour = parseInt(timeMatch[1]);
              const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
              const ampm = timeMatch[3]?.toLowerCase();
              
              if (ampm === 'pm' && hour !== 12) hour += 12;
              if (ampm === 'am' && hour === 12) hour = 0;
              
              event.time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            } else {
              event.time = '09:00'; // Default fallback
            }
          }
          return event;
        });
      }
      
      // Fix invalid frequency values
      if (path.includes('targetPerWeek') && typeof recovered.frequency?.targetPerWeek === 'string') {
        const parsed = parseInt(recovered.frequency.targetPerWeek);
        if (!isNaN(parsed) && parsed > 0) {
          recovered.frequency.targetPerWeek = parsed;
          warnings.push('Converted string targetPerWeek to integer');
        }
      }
    }
    
    // Try validation again with recovered data
    const spec = GoalSpecSchema.parse(recovered);
    return { spec, warnings, errors: [] };
    
  } catch (error) {
    return { spec: null, warnings, errors: ['Recovery failed'] };
  }
}

// Helper function to check if data has required fields for each type
export function validateTypeSpecificFields(spec: GoalSpec): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Only validate if type is specified
  if (spec.type) {
    switch (spec.type) {
      case 'schedule':
        if (!spec.schedule?.events || spec.schedule.events.length === 0) {
          errors.push('Schedule type requires at least one event');
        }
        break;
        
      case 'frequency':
        if (!spec.frequency?.targetPerWeek || spec.frequency.targetPerWeek <= 0) {
          errors.push('Frequency type requires positive targetPerWeek');
        }
        break;
        
      case 'milestone':
        if (!spec.milestone?.milestones || spec.milestone.milestones.length === 0) {
          errors.push('Milestone type requires at least one milestone');
        }
        break;
    }
  }
  
  return { valid: errors.length === 0, errors };
}
