import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Partner {
  id?: string;
  inviteEmail?: string;
  status?: 'pending' | 'accepted' | 'declined';
}

interface PartnerPickerProps {
  partner?: Partner;
  onChange: (partner?: Partner) => void;
}

export const PartnerPicker: React.FC<PartnerPickerProps> = ({ partner, onChange }) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [partnerId, setPartnerId] = useState('');

  const handleInvite = () => {
    if (inviteEmail.trim()) {
      console.log('[CreateGoal] Partner invited via email:', inviteEmail.trim());
      onChange({ inviteEmail: inviteEmail.trim(), status: 'pending' });
      setInviteEmail('');
    }
  };

  const handleSelect = () => {
    if (partnerId.trim()) {
      console.log('[CreateGoal] Partner selected by ID:', partnerId.trim());
      onChange({ id: partnerId.trim(), status: 'accepted' });
      setPartnerId('');
    }
  };

  const handleRemove = () => {
    console.log('[CreateGoal] Partner removed');
    onChange(undefined);
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 16, fontWeight: '500', color: '#374151', marginBottom: 12 }}>Choose Partner</Text>
      
      {/* Current Partner Status */}
      {partner && (
        <View style={{ 
          backgroundColor: '#f3f4f6', 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 16,
          borderWidth: 1, 
          borderColor: '#d1d5db' 
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#374151', fontSize: 14, fontWeight: '500' }}>
                {partner.inviteEmail ? `Invited: ${partner.inviteEmail}` : `Partner ID: ${partner.id}`}
              </Text>
            </View>
            <View style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: partner.status === 'accepted' ? '#d1fae5' : 
                             partner.status === 'pending' ? '#fef3c7' : '#fee2e2'
            }}>
              <Text style={{ 
                color: partner.status === 'accepted' ? '#065f46' : 
                       partner.status === 'pending' ? '#92400e' : '#991b1b',
                fontSize: 12,
                fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {partner.status}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleRemove}
            style={{ marginTop: 8 }}
          >
            <Text style={{ color: '#dc2626', fontSize: 12 }}>Remove Partner</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Invite by Email */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Invite by email</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={{ 
              flex: 1,
              backgroundColor: 'white', 
              borderRadius: 8, 
              borderWidth: 1, 
              borderColor: '#d1d5db',
              paddingHorizontal: 12,
              paddingVertical: 8,
              color: '#374151'
            }}
            placeholder="partner@example.com"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity
            onPress={handleInvite}
            style={{ 
              backgroundColor: '#3b82f6', 
              borderRadius: 8, 
              paddingHorizontal: 16,
              paddingVertical: 8,
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>Invite</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pick Existing Partner */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Pick existing partner</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={{ 
              flex: 1,
              backgroundColor: 'white', 
              borderRadius: 8, 
              borderWidth: 1, 
              borderColor: '#d1d5db',
              paddingHorizontal: 12,
              paddingVertical: 8,
              color: '#374151'
            }}
            placeholder="Partner ID or username"
            value={partnerId}
            onChangeText={setPartnerId}
            autoCapitalize="none"
          />
          <TouchableOpacity
            onPress={handleSelect}
            style={{ 
              backgroundColor: '#10b981', 
              borderRadius: 8, 
              paddingHorizontal: 16,
              paddingVertical: 8,
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>Select</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
