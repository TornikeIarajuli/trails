import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { usersService } from '../services/users';
import { useDebounce } from '../hooks/useDebounce';
import { Avatar } from '../components/ui/Avatar';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading } = useQuery({
    queryKey: ['userSearch', debouncedQuery],
    queryFn: () => usersService.searchUsers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={Colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or name..."
          placeholderTextColor={Colors.textLight}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {debouncedQuery.length < 2 ? (
        <View style={styles.hintContainer}>
          <Ionicons name="people-outline" size={48} color={Colors.borderLight} />
          <Text style={styles.hintText}>Type at least 2 characters to search</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => {
                router.back();
                setTimeout(() => router.push(`/trail/user/${item.id}`), 100);
              }}
            >
              <Avatar uri={item.avatar_url} name={item.full_name || item.username} size={44} />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.username}</Text>
                {item.full_name && (
                  <Text style={styles.userFullName}>{item.full_name}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>No users found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  hintContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  hintText: {
    fontSize: 15,
    color: Colors.textLight,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  userFullName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
