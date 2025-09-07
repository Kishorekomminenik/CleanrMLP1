// Dispatch Service for SHINE
// Handles dispatch cancellation and related functionality

import { Alert } from 'react-native';

export interface CancelPolicyInfo {
  cancellable: boolean;
  fee: number;
  refundCredit: number;
  policyText: string;
  timeWindowMins: number;
}

export interface CancelResponse {
  ok: boolean;
  refundCredit: number;
  policyApplied: string;
  reason?: string;
}

export class DispatchService {
  private static BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // Show cancel policy modal and get confirmation
  static showCancelPolicyModal(policyInfo: CancelPolicyInfo): Promise<boolean> {
    return new Promise((resolve) => {
      const message = policyInfo.fee > 0 
        ? `A cancellation fee of $${policyInfo.fee.toFixed(2)} will apply. You'll receive $${policyInfo.refundCredit.toFixed(2)} in SHINE credits.\n\n${policyInfo.policyText}`
        : `You'll receive $${policyInfo.refundCredit.toFixed(2)} in SHINE credits.\n\n${policyInfo.policyText}`;

      Alert.alert(
        'Cancel Request',
        message,
        [
          {
            text: 'Keep Request',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Cancel Request',
            style: 'destructive',
            onPress: () => resolve(true)
          }
        ]
      );
    });
  }

  // Cancel dispatch request
  static async cancelRequest(bookingId: string, userToken: string): Promise<CancelResponse | null> {
    if (!this.BACKEND_URL || !userToken) {
      throw new Error('Backend URL or token not available');
    }

    try {
      // Emit telemetry
      console.log('[TELEMETRY] dispatch.cancel.tap', { bookingId });

      const response = await fetch(`${this.BACKEND_URL}/dispatch/cancel/${bookingId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[TELEMETRY] dispatch.cancel.success', { bookingId, refundCredit: result.refundCredit });
        return result;
      } else if (response.status === 409) {
        // Too late to cancel
        const errorData = await response.json();
        console.log('[TELEMETRY] dispatch.cancel.error', { bookingId, reason: 'too_late' });
        
        Alert.alert(
          'Too Late to Cancel',
          errorData.detail || 'Your partner is already on the way. Please contact support if needed.',
          [{ text: 'OK' }]
        );
        return null;
      } else {
        throw new Error(`Cancel request failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Cancel request error:', error);
      console.log('[TELEMETRY] dispatch.cancel.error', { bookingId, error: error.message });
      
      Alert.alert(
        'Cancel Failed',
        'Unable to cancel request. Please try again or contact support.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  }

  // Handle full cancel flow with policy check
  static async handleCancelFlow(bookingId: string, userToken: string): Promise<boolean> {
    try {
      // Mock policy info - in real app would fetch from API
      const policyInfo: CancelPolicyInfo = {
        cancellable: true,
        fee: 5.00,
        refundCredit: 20.00,
        policyText: 'Cancellation fees help cover partner preparation costs.',
        timeWindowMins: 15
      };

      // Show policy modal and get confirmation
      const confirmed = await this.showCancelPolicyModal(policyInfo);
      if (!confirmed) return false;

      // Proceed with cancellation
      const result = await this.cancelRequest(bookingId, userToken);
      
      if (result) {
        // Show success message
        Alert.alert(
          'Request Cancelled',
          `Your request has been cancelled. $${result.refundCredit.toFixed(2)} in credits will be added to your account.`,
          [{ text: 'OK' }]
        );
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Cancel flow error:', error);
      return false;
    }
  }

  // Get mock policy info (in real app would fetch from API)
  static async getCancelPolicy(bookingId: string, userToken: string): Promise<CancelPolicyInfo> {
    // Mock implementation
    return {
      cancellable: true,
      fee: 5.00,
      refundCredit: 20.00,
      policyText: 'Cancellation fees help cover partner preparation costs.',
      timeWindowMins: 15
    };
  }
}

export default DispatchService;