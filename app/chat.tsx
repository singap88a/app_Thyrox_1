import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as signalR from "@microsoft/signalr";
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from "../constants/api";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";

interface Message {
  senderId: string;
  receiverId: string;
  content: string;
  imageUrl?: string;
  senderType: string;
  sentAt: string;
  isRead: boolean;
}

export default function ChatScreen() {
  const router = useRouter();
  const { patientId, doctorId } = useLocalSearchParams<{ patientId: string; doctorId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const emojis = ['😊', '😂', '❤️', '👍', '🙏', '🔥', '💊', '🏥', '🩺', '✅'];

  // Use IDs from params with robust fallbacks
  const myId = patientId?.toString(); 
  const targetId = doctorId?.toString();

  useEffect(() => {
    console.log(`Chat Screen Loaded: PatientId=${myId}, DoctorId=${targetId}`);
    if (myId && targetId) {
      fetchHistory();
      setupSignalR();
    }
  }, [myId, targetId]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/Chat/History/${myId}/${targetId}`);
      setMessages(res.data || []);
    } catch (err) {
      console.error("Failed to fetch chat history", err);
    } finally {
      setLoading(false);
    }
  };

  const setupSignalR = async () => {
    if (!myId) return;
    const hubUrl = `${API_BASE_URL}/chatHub`;
    console.log(`Connecting to SignalR: ${hubUrl}?userId=${myId}`);
    
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubUrl}?userId=${myId}`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    newConnection.on("ReceiveMessage", (message: Message) => {
      if (
        (message.senderId === myId && message.receiverId === targetId) ||
        (message.senderId === targetId && message.receiverId === myId)
      ) {
        setMessages((prev) => {
          // Prevent duplicates
          const isDuplicate = prev.some(m => 
            m.content === message.content && 
            new Date(m.sentAt).getTime() === new Date(message.sentAt).getTime()
          );
          if (isDuplicate) return prev;
          return [...prev, message];
        });
      }
    });

    try {
      await newConnection.start();
      setConnection(newConnection);
    } catch (err) {
      console.error("SignalR Connection Error: ", err);
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || sending) return;

    const content = newMessage.trim();
    const imageUri = selectedImage;

    setNewMessage("");
    setSelectedImage(null);
    setSending(true);
    setShowEmojis(false);

    try {
      let finalImageUrl = null;

      // 1. Upload image if exists
      if (imageUri) {
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          formData.append('image', blob, 'photo.jpg');
        } else {
          // @ts-ignore
          formData.append('image', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' });
        }
        formData.append('senderId', myId!);
        formData.append('receiverId', targetId!);

        const uploadRes = await axios.post(`${API_BASE_URL}/api/Chat/UploadImage`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        finalImageUrl = uploadRes.data.imageUrl;
      }

      // 2. Save Message
      const messageData = {
        senderId: myId,
        receiverId: targetId,
        content: content || '[Image]',
        imageUrl: finalImageUrl,
        senderType: "Patient",
        patientId: parseInt(myId!),
        doctorId: parseInt(targetId!),
      };

      await axios.post(`${API_BASE_URL}/api/Chat/Save`, messageData);

      // 3. Optimistic Add
      setMessages(prev => [...prev, { ...messageData, sentAt: new Date().toISOString(), isRead: false } as Message]);

      // 4. Broadcast
      if (connection) {
        await connection.invoke("SendMessage", myId, targetId, content || '[Image]', finalImageUrl, "Patient");
      }
    } catch (err) {
      console.error("Failed to send message", err);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].uri) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderType === "Patient";
    const fullImageUrl = item.imageUrl ? (item.imageUrl.startsWith('http') ? item.imageUrl : `${API_BASE_URL}${item.imageUrl}`) : null;

    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {item.content !== "[Image]" && (
            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
              {item.content}
            </Text>
          )}
          {fullImageUrl && (
            <Image source={{ uri: fullImageUrl }} style={styles.attachedImage} resizeMode="cover" />
          )}
          <Text style={[styles.timeText, isMe && { color: "#0a0f1e80" }]}>
            {new Date(item.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Connecting to clinic...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Clinic Support</Text>
          <View style={styles.onlineStatus}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Doctor is online</Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {selectedImage && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            <TouchableOpacity 
              style={styles.removePreviewBtn} 
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close-circle" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
        {showEmojis && (
          <View style={styles.emojiPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {emojis.map(e => (
                <TouchableOpacity key={e} onPress={() => setNewMessage(prev => prev + e)} style={styles.emojiBtn}>
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <View style={styles.inputArea}>
          <TouchableOpacity onPress={() => setShowEmojis(!showEmojis)} style={styles.iconBtn}>
            <Ionicons name="happy-outline" size={24} color={showEmojis ? "#00d4ff" : "#6b7280"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickImage} style={styles.iconBtn}>
            <Ionicons name="image-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Ask your doctor..."
            placeholderTextColor="#6b7280"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() && !selectedImage) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedImage) || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e" },
  centered: { flex: 1, backgroundColor: "#0a0f1e", alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#6b7280", marginTop: 10, fontWeight: "bold" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e2d4a",
  },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  headerInfo: { marginLeft: 10 },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "900" },
  onlineStatus: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ade80", marginRight: 5 },
  onlineText: { color: "#4ade80", fontSize: 10, fontWeight: "bold" },
  listContent: { padding: 20, paddingBottom: 40 },
  messageContainer: { marginBottom: 15, flexDirection: "row" },
  myMessage: { justifyContent: "flex-end" },
  theirMessage: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 20 },
  myBubble: { backgroundColor: "#00d4ff", borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: "#111827", borderBottomLeftRadius: 2, borderWidth: 1, borderColor: "#1e2d4a" },
  messageText: { fontSize: 14, lineHeight: 20 },
  myMessageText: { color: "#0a0f1e", fontWeight: "600" },
  theirMessageText: { color: "white" },
  timeText: { fontSize: 8, color: "#6b7280", marginTop: 5, alignSelf: "flex-end" },
  attachedImage: { width: 220, height: 160, borderRadius: 15, marginTop: 5 },
  previewContainer: {
    padding: 10,
    backgroundColor: "#111827",
    borderTopWidth: 1,
    borderTopColor: "#1e2d4a",
    flexDirection: 'row',
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  removePreviewBtn: {
    position: 'absolute',
    top: 5,
    left: 85,
  },
  emojiPanel: { backgroundColor: "#111827", padding: 10, borderTopWidth: 1, borderTopColor: "#1e2d4a" },
  emojiBtn: { padding: 8, marginHorizontal: 5 },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#111827",
    borderTopWidth: 1,
    borderTopColor: "#1e2d4a",
  },
  iconBtn: { padding: 8 },
  input: {
    flex: 1,
    backgroundColor: "#0d1520",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: "white",
    maxHeight: 100,
    marginHorizontal: 5,
  },
  sendButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#00d4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { backgroundColor: "#1e2d4a" },
});
