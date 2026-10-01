import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker'; // <--- The import
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
export default function DashboardScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); 
  const [isModalVisible, setModalVisible] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitLevel, setNewUnitLevel] = useState('bureau_central'); // <--- The new state
  
  // IMPORTANT: Change this to your actual hotspot IP!
  const API_URL = 'http://192.168.1.19:8000/api'; 

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      };

      const [userRes, unitsRes] = await Promise.all([
        fetch(`${API_URL}/user`, { headers }),
        fetch(`${API_URL}/units`, { headers })
      ]);

      if (userRes.ok && unitsRes.ok) {
        setUserData(await userRes.json());
        setUnits(await unitsRes.json());
      }
    } catch (error) {
      console.error('Network error:', error);
    } finally {
      setLoading(false);
    }
  };
  // NEW: Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData(); // Re-runs your existing fetch function!
    setRefreshing(false);
  };
  const formatLevel = (level: string) => {
    if (!level) return 'Unit';
    return level.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getLevelColors = (level: string) => {
    switch (level) {
      case 'bureau_central': return { bg: '#E3F2FD', text: '#1976D2' }; // Blue
      case 'national': return { bg: '#F3E5F5', text: '#7B1FA2' }; // Purple
      case 'regional': return { bg: '#FFF3E0', text: '#F57C00' }; // Orange
      default: return { bg: '#EEEEEE', text: '#757575' }; // Gray
    }
  };
  const handleCreateUnit = async () => {
    if (!newUnitName.trim()) {
      Alert.alert('Error', 'Unit name cannot be empty!');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/units`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newUnitName,
          level: newUnitLevel // <--- Passing the selected level to Laravel
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUnits([data, ...units]);
        setModalVisible(false);
        setNewUnitName('');
        setNewUnitLevel('bureau_central'); // Resetting it for next time
      } else {
        Alert.alert('Error', data.message || 'Failed to create unit');
      }
    } catch (error) {
      console.error('Create error:', error);
      Alert.alert('Error', 'Network error occurred');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1B5E20" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Tansiq</Text>
          <Text style={styles.subtitle}>Welcome, {userData?.name}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

 <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Units</Text>
        
        {userData && (userData.role === 'Bureau Central' || userData.role === 'admin') && (
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.addButtonText}>New Unit</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={units}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={<Text style={styles.emptyText}>No units found. Create one!</Text>}
        
        // NEW: The pull-to-refresh component
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#1B5E20']} // Matches your green theme (Android)
            tintColor="#1B5E20"  // Matches your green theme (iOS)
          />
        }

        renderItem={({ item }) => {
          const colors = getLevelColors(item.level);
          return (
            <TouchableOpacity 
              style={styles.card}
              onPress={() => router.push({
                pathname: "/unit/[id]",
                params: { id: item.id, name: item.name || item.title }
              })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name || item.title}</Text>
                
                {/* NEW: Dynamic Level Badge */}
                <View style={[styles.levelBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.levelText, { color: colors.text }]}>
                    {formatLevel(item.level)}
                  </Text>
                </View>
              </View>
          </TouchableOpacity>
          );
        }}
      />

      {/* The Popup Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Unit</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Unit Name (e.g. IT Department)"
              value={newUnitName}
              onChangeText={setNewUnitName}
            />

            {/* <--- Here is the Picker being used! ---> */}
            <Text style={styles.label}>Select Level:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={newUnitLevel}
                onValueChange={(itemValue) => setNewUnitLevel(itemValue)}
              >
                <Picker.Item label="Bureau Central" value="bureau_central" />
                <Picker.Item label="National" value="national" />
                <Picker.Item label="Regional" value="regional" />
              </Picker>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.saveButton} onPress={handleCreateUnit}>
                <Text style={styles.buttonText}>Save Unit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 24, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1B5E20' },
  subtitle: { fontSize: 16, color: '#666' },
  logoutButton: { backgroundColor: '#D32F2F', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  addButton: { backgroundColor: '#1B5E20', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  cardSubtitle: { fontSize: 14, color: '#666', marginTop: 4, textTransform: 'capitalize' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 24 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  levelText: { fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', padding: 24, borderRadius: 12, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1B5E20', marginBottom: 16 },
  input: { backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 16, fontSize: 16 },
  
  // Picker styles
  label: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  pickerContainer: { backgroundColor: '#f5f5f5', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 24 },
  
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelButton: { padding: 12 },
  cancelButtonText: { color: '#666', fontWeight: 'bold', fontSize: 16 },
  saveButton: { backgroundColor: '#1B5E20', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
});