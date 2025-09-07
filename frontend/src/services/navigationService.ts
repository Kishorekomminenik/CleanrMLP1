// Navigation Service for SHINE
// Handles logout, back button guards, and navigation policies

import { Alert } from 'react-native';

export interface NavigationGuard {
  canLeave: boolean;
  message?: string;
  title?: string;
}

export class NavigationService {
  private static requestsInFlight: Set<string> = new Set();
  private static unsavedChanges: Set<string> = new Set();

  // Track in-flight requests
  static addRequest(requestId: string) {
    this.requestsInFlight.add(requestId);
  }

  static removeRequest(requestId: string) {
    this.requestsInFlight.delete(requestId);
  }

  static hasRequestsInFlight(): boolean {
    return this.requestsInFlight.size > 0;
  }

  // Track unsaved changes
  static markUnsaved(screenId: string) {
    this.unsavedChanges.add(screenId);
  }

  static markSaved(screenId: string) {
    this.unsavedChanges.delete(screenId);
  }

  static hasUnsavedChanges(screenId?: string): boolean {
    if (screenId) {
      return this.unsavedChanges.has(screenId);
    }
    return this.unsavedChanges.size > 0;
  }

  // Navigation guards per screen
  static getNavigationGuard(pageId: string, context?: any): NavigationGuard {
    switch (pageId) {
      case 'PAGE-5-CHECKOUT':
        if (this.hasRequestsInFlight()) {
          return {
            canLeave: false,
            title: 'Leave checkout?',
            message: 'Quote or booking in progress. Changes may be lost.'
          };
        }
        break;

      case 'PAGE-6-DISPATCH':
        return {
          canLeave: false,
          title: 'Cancel request?',
          message: 'Use "Cancel Request" to properly cancel your booking.'
        };

      case 'PAGE-7-LIVE-JOB':
        if (context?.uploading) {
          return {
            canLeave: false,
            title: 'Leave job?',
            message: 'Photo upload in progress. Changes may be lost.'
          };
        }
        break;

      case 'PAGE-8-RATE-TIP':
        if (context?.tipEntered && !context?.tipSent) {
          return {
            canLeave: false,
            title: 'Leave rating?',
            message: 'Tip entered but not sent. Changes may be lost.'
          };
        }
        break;

      case 'PAGE-10-SUPPORT':
        if (this.hasUnsavedChanges('support') || context?.composing) {
          return {
            canLeave: false,
            title: 'Leave support?',
            message: 'Message being composed. Changes may be lost.'
          };
        }
        break;

      case 'PAGE-18-SETTINGS':
        if (this.hasUnsavedChanges('settings')) {
          return {
            canLeave: false,
            title: 'Leave settings?',
            message: 'You have unsaved changes. Changes may be lost.'
          };
        }
        break;

      default:
        return { canLeave: true };
    }

    return { canLeave: true };
  }

  // Show back confirmation dialog
  static showBackConfirmation(guard: NavigationGuard): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        guard.title || 'Leave this screen?',
        guard.message || 'Action in progress. Changes may be lost.',
        [
          {
            text: 'Stay Here',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Leave Anyway',
            style: 'destructive', 
            onPress: () => resolve(true)
          }
        ]
      );
    });
  }

  // Handle hardware back button
  static async handleBackPress(pageId: string, context?: any): Promise<boolean> {
    const guard = this.getNavigationGuard(pageId, context);
    
    if (!guard.canLeave) {
      const shouldLeave = await this.showBackConfirmation(guard);
      return !shouldLeave; // Return true to prevent navigation
    }
    
    return false; // Allow navigation
  }
}

// Logout Service
export class LogoutService {
  private static BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  static async logout(userToken: string, devicePushToken?: string): Promise<boolean> {
    try {
      // Best effort API call to logout
      if (this.BACKEND_URL && userToken) {
        await fetch(`${this.BACKEND_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            devicePushToken: devicePushToken || null
          })
        });
      }

      // Clear all local state regardless of API response
      await this.clearLocalState();
      
      // Emit telemetry
      this.emitTelemetry('auth.logout.success');
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      
      // Still clear local state even if API fails
      await this.clearLocalState();
      
      // Emit error telemetry
      this.emitTelemetry('auth.logout.error', { error: error.message });
      
      return true; // Always return true to complete logout
    }
  }

  private static async clearLocalState() {
    // Clear navigation state
    NavigationService.requestsInFlight.clear();
    NavigationService.unsavedChanges.clear();
    
    // Clear any stored tokens or user data
    // This would integrate with your auth storage mechanism
    console.log('Clearing local authentication state...');
  }

  private static emitTelemetry(event: string, properties?: any) {
    console.log(`[TELEMETRY] ${event}`, properties);
    // This would integrate with your analytics service
  }

  static showLogoutConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Log out?',
        "You'll need to log in again.",
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Log out',
            style: 'destructive',
            onPress: () => resolve(true)
          }
        ]
      );
    });
  }
}

export default NavigationService;