// The brand mark: a half sun rising through a broken horizon line.
// Drawn with plain Views so it needs no SVG library.
import { StyleSheet, View } from 'react-native';
import { brand } from '../theme';

interface Props {
  size?: number;
  sunColor?: string;
  lineColor?: string;
}

export function HorizonMark({ size = 64, sunColor = brand.amber, lineColor = brand.amber }: Props) {
  const sunWidth = size * 0.56;
  const lineHeight = Math.max(2, Math.round(size * 0.05));
  return (
    <View style={{ width: size, height: size * 0.62 }} accessible={false} importantForAccessibility="no-hide-descendants">
      <View
        style={[
          styles.sun,
          {
            width: sunWidth,
            height: sunWidth / 2,
            borderTopLeftRadius: sunWidth / 2,
            borderTopRightRadius: sunWidth / 2,
            backgroundColor: sunColor,
            left: (size - sunWidth) / 2,
            bottom: lineHeight * 2,
          },
        ]}
      />
      <View style={[styles.line, { width: size * 0.34, height: lineHeight, backgroundColor: lineColor, left: 0 }]} />
      <View style={[styles.line, { width: size * 0.34, height: lineHeight, backgroundColor: lineColor, right: 0 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  sun: { position: 'absolute' },
  line: { position: 'absolute', bottom: 0, borderRadius: 2 },
});
