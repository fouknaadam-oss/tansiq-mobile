import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
export default function UnitDetailsScreen() {
  const { id, name } = useLocalSearchParams();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  // IMPORTANT: Keep your actual hotspot IP here!
  const API_URL = 'http://192.168.1.19:8000/api';
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [taskStatus, setTaskStatus] = useState('pending'); // To track the workflow state
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetchCurrentUser = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/user`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };
  useEffect(() => {
    fetchTasks();
    fetchCurrentUser(); // <-- Add this line
  }, [id]);

  const fetchTasks = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/tasks?unit_id=${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Network error:', error);
    } finally {
      setLoading(false);
    }
  };
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };
  const fetchUsers = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');    
    const response = await fetch(`${API_URL}/users`, {
      headers: { 'Authorization': `Bearer ${token}` , 'Accept': 'application/json' },
    });
    if (response.ok) {
        const data = await response.json();
        setUsers(data);
    }
  } catch (error) {
    console.error('Failed to fetch users:', error);
  }
};
const openEditModal = (task: any) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description || '');
    setTaskStatus(task.status || 'pending');
    setDueDate(task.due_date ? new Date(task.due_date) : new Date());
    setAssignedTo(task.assigned_to);
    setEditModalVisible(true);
    setSubmissionNotes(task.submission_notes || '');
  };
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Error', 'Task title cannot be empty!');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTaskTitle, 
          description: newTaskDescription, // <--- Send it to Laravel!
          unit_id: id,         
          status: 'pending',  
          due_date: dueDate.toISOString().split('T')[0], 
          assigned_to: assignedTo,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTasks([data, ...tasks]);
        setModalVisible(false);
        setNewTaskTitle('');
        setNewTaskDescription(''); 
      } else {
        Alert.alert('Error', data.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('Create error:', error);
      Alert.alert('Error', 'Network error occurred');
    }
  };
const handleUpdateTask = async () => {
    if (!newTaskTitle.trim() || !editingTask) return;
    
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDescription,
          status: taskStatus, // The new workflow status
          submission_notes: submissionNotes, // Include submission notes if any
          due_date: dueDate.toISOString().split('T')[0],
          assigned_to: assignedTo,
          unit_id: id
        }),
      });

      if (response.ok) {
        setEditModalVisible(false);
        setEditingTask(null);
        fetchTasks(); // Refresh the list to show the new status
      } else {
        console.error('Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };
  // NEW FUNCTION: Cycle through statuses and save to database
  const handleUpdateStatus = async (task: any) => {
    // 1. Figure out what the next status should be
    const statusFlow: { [key: string]: string } = {
      'pending': 'in_progress',
      'in_progress': 'completed',
      'completed': 'pending'
    };
    const newStatus = statusFlow[task.status] || 'pending';

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // 2. Instantly update the UI so it feels fast
        setTasks(tasks.map(t => (t.id === task.id ? { ...t, status: newStatus } : t)));
      } else {
        Alert.alert('Error', 'Failed to update status');
      }
    } catch (error) {
      console.error('Update error:', error);
    }
  };
// NEW FUNCTION: Long press to delete a task
  const handleDeleteTask = (taskId: number) => {
    Alert.alert(
      "Delete Task",
      "Are you sure you want to delete this task? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              const response = await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                },
              });

              if (response.ok) {
                // Remove it from the screen immediately!
                setTasks(tasks.filter(t => t.id !== taskId));
              } else {
                Alert.alert('Error', 'Failed to delete task');
              }
            } catch (error) {
              console.error('Delete error:', error);
            }
          }
        }
      ]
    );
  };
  // Helper function to pick the right color for the badge
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#388E3C'; // Green
      case 'in_progress': return '#F57C00'; // Orange
      default: return '#D32F2F'; // Red (Pending)
    }
  };

  const formatStatusText = (status: string) => {
    if (status === 'in_progress') return 'In Progress';
    if (status === 'completed') return 'Completed';
    return 'Pending';
  };
  const filteredTasks = tasks.filter(task => activeFilter === 'all' ? true : task.status === activeFilter);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1B5E20" />
          <Text style={styles.backText}>Dashboard</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{name}</Text>
      <Text style={styles.subtitle}>Unit ID: {id}</Text>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.addButtonText}>New Task</Text>
          </TouchableOpacity>
      </View>
      <View style={styles.filterContainer}>
        {(['all', 'pending', 'in_progress', 'completed'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterChip, activeFilter === status && styles.activeFilterChip]}
            onPress={() => setActiveFilter(status)}
          >
            <Text style={[styles.filterText, activeFilter === status && styles.activeFilterText]}>
              {status === 'all' ? 'All' : status.replace('_', ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#1B5E20" />
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={<Text style={styles.emptyText}>No tasks yet. Let's add some!</Text>}
          refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={['#1B5E20']} // Matches your app's green theme
              />
            }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.taskCard}
              onLongPress={() => handleDeleteTask(item.id)}
              delayLongPress={500} 
            >
              <View style={styles.taskInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.taskTitle}>{item.title || item.name}</Text>
                  <TouchableOpacity onPress={() => openEditModal(item)}>
                    <Ionicons name="pencil-outline" size={18} color="#1B5E20" />
                  </TouchableOpacity>
                </View>
                {/* NEW: Render Submission Notes if they exist */}
                {item.submission_notes ? (
                  <View style={styles.notesContainer}>
                    <Ionicons name="link-outline" size={14} color="#555" />
                    <Text style={styles.notesText} numberOfLines={1}>
                      {item.submission_notes}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>{formatStatusText(item.status)}</Text>
                </View>
                {item.due_date && (
                  <View style={styles.dueDateBadge}>
                    <Ionicons name="time-outline" size={14} color="#D32F2F" />
                    <Text style={styles.dueDateText}>{item.due_date}</Text>
                  </View>
                )}
                {item.assigned_to && (
                  <View style={styles.assigneeBadge}>
                    <Ionicons name="person-outline" size={14} color="#1976D2" />
                    <Text style={styles.assigneeText}>
                      {users.find(user => user.id === item.assigned_to)?.name || 'Assigned'}
                    </Text>
                  </View>
                )}
              </View>
              
              <TouchableOpacity 
                style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}
                onPress={() => handleUpdateStatus(item)}
              >
                <Text style={styles.statusBadgeText}>
                  {item.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* The Popup Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Task</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Task Title..."
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
            />
            
            {/* NEW MULTILINE INPUT */}
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Task Description (Optional)..."
              value={newTaskDescription}
              onChangeText={setNewTaskDescription}
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.datePickerContainer}>
              <Text style={styles.dateLabel}>Due Date:</Text>
              <TouchableOpacity 
                style={styles.dateButton} 
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#1B5E20" />
                <Text style={styles.dateButtonText}>{dueDate.toDateString()}</Text>
              </TouchableOpacity>
            </View>

            {/* The Actual Calendar Component */}
            {showDatePicker && (
              <DateTimePicker
                value={dueDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onValueChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setDueDate(selectedDate);
                }}
                onDismiss={() => setShowDatePicker(false)}
              />
            )}
            <View style={styles.pickerContainer}>
              <Text style={styles.dateLabel}>Assign To:</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={assignedTo}
                  onValueChange={(itemValue) => setAssignedTo(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Unassigned" value={null} color="#888" />
                  {users.map((user) => (
                    <Picker.Item key={user.id} label={user.name} value={user.id} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.saveButton} onPress={handleCreateTask}>
                <Text style={styles.buttonText}>Save Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* NEW: The Edit Task Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Task</Text>

            <TextInput
              style={styles.input}
              placeholder="Task Title"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={newTaskDescription}
              onChangeText={setNewTaskDescription}
              multiline
            />

            {/* NEW: Status Picker for Workflow */}
            <View style={styles.pickerContainer}>
              <Text style={styles.dateLabel}>Status:</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={taskStatus}
                  onValueChange={(itemValue) => setTaskStatus(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Pending" value="pending" color="#D32F2F" />
                  <Picker.Item label="In Progress" value="in_progress" color="#F57C00" />
                  <Picker.Item label="Completed" value="completed" color="#388E3C" />
                </Picker>
              </View>
            </View>
            <TextInput
              style={[styles.input, styles.textArea, { marginTop: 12 }]}
              placeholder="Submission Notes / Deliverable Link..."
              value={submissionNotes}
              onChangeText={setSubmissionNotes}
              multiline
            />

            {/* User Assignment Picker */}
            <View style={styles.pickerContainer}>
              <Text style={styles.dateLabel}>Re-assign To:</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={assignedTo}
                  onValueChange={(itemValue) => setAssignedTo(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Unassigned" value={null} color="#888" />
                  {users.map((user) => (
                    <Picker.Item key={user.id} label={user.name} value={user.id} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingTask(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleUpdateTask}>
                <Text style={styles.buttonText}>Update Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f5f5f5' },
  header: { marginTop: 24, marginBottom: 16 },
  backButton: { paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 16, color: '#1B5E20', fontWeight: 'bold' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 16 },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  addButton: { backgroundColor: '#1B5E20', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
// Filter Styles
  filterContainer: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e0e0e0' },
  activeFilterChip: { backgroundColor: '#1B5E20' },
  filterText: { fontSize: 12, color: '#333', fontWeight: 'bold' },
  activeFilterText: { color: '#fff' },
  // Updated Task Card styles to make room for the badge
  taskCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#1B5E20', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  taskTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1, marginRight: 12 },
  // Add this to format the card layout better
  taskInfo: { flex: 1, marginRight: 12 },
  taskDescription: { fontSize: 14, color: '#666', marginTop: 4 },
  
  // Add this for the multiline input box
  textArea: { height: 100, paddingTop: 12 },
  // New Status Badge styles

  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  emptyText: { color: '#888', fontSize: 16, textAlign: 'center', marginTop: 24 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', padding: 24, borderRadius: 12, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1B5E20', marginBottom: 16 },
  input: { backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 24, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelButton: { padding: 12 },
  cancelButtonText: { color: '#666', fontWeight: 'bold', fontSize: 16 },
  saveButton: { backgroundColor: '#1B5E20', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  datePickerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, justifyContent: 'space-between' },
  dateLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  dateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 8 },
  dateButtonText: { fontSize: 16, color: '#1B5E20', fontWeight: 'bold' },
  dueDateBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  dueDateText: { fontSize: 12, color: '#D32F2F', fontWeight: 'bold' },
  pickerContainer: { marginBottom: 24 },
  pickerWrapper: { backgroundColor: '#f5f5f5', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginTop: 8 },
  picker: { height: 50, width: '100%' },
  assigneeBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  assigneeText: { fontSize: 12, color: '#1976D2', fontWeight: 'bold' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginVertical: 6 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  notesContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 8, backgroundColor: '#E8F5E9', borderRadius: 6, gap: 6 },
  notesText: { fontSize: 13, color: '#2E7D32', flex: 1, fontStyle: 'italic' },
});