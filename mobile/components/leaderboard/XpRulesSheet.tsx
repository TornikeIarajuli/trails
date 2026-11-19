import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sheet } from '../ui/Sheet';
import { useColors, ColorPalette } from '../../constants/colors';
import { LEVELS, XP_RULES } from '../../utils/xp';

/** "How XP works": what earns XP, and the levels. */
export function XpRulesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <Sheet visible={visible} onClose={onClose} title="How XP works">
      <View style={styles.body}>
        {XP_RULES.map((rule) => (
          <View key={rule.label} style={styles.rule}>
            <View style={styles.ruleText}>
              <Text style={styles.label}>{rule.label}</Text>
              {rule.note ? <Text style={styles.note}>{rule.note}</Text> : null}
            </View>
            <Text style={styles.xp}>{rule.xp}</Text>
          </View>
        ))}

        <Text style={styles.heading}>Levels</Text>
        <View style={styles.levels}>
          {LEVELS.map((level) => (
            <View key={level.level} style={styles.level}>
              <Text style={styles.levelName}>
                {level.level}. {level.name}
              </Text>
              <Text style={styles.levelXp}>{level.minXp.toLocaleString('en-US')} XP</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footnote}>
          The week starts on Monday, Georgian time. Hikes under five minutes earn nothing.
        </Text>
      </View>
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    body: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 10,
    },
    rule: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 4,
    },
    ruleText: {
      flex: 1,
      gap: 1,
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    note: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    xp: {
      maxWidth: '45%',
      fontSize: 14,
      fontWeight: '700',
      color: Colors.primary,
      textAlign: 'right',
    },
    heading: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    levels: {
      gap: 6,
    },
    level: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    levelName: {
      fontSize: 14,
      color: Colors.text,
    },
    levelXp: {
      fontSize: 14,
      color: Colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    footnote: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 17,
      color: Colors.textLight,
    },
  });
