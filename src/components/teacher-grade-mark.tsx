import Svg, { G, Path } from 'react-native-svg';

type TeacherGradeMarkProps = {
  correct: boolean;
  size?: number;
};

const RED_INK = '#C9363E';
const RED_INK_DARK = '#8F2028';

export function TeacherGradeMark({ correct, size = 58 }: TeacherGradeMarkProps) {
  const height = size * 64 / 72;
  return (
    <Svg
      width={size}
      height={height}
      viewBox="0 0 72 64"
      accessibilityRole="image"
      accessibilityLabel={correct ? '批改结果：正确' : '批改结果：错误'}
    >
      <G transform={`rotate(${correct ? -7 : -4} 36 32)`}>
        {correct ? (
          <>
            <Path d="M7 34 C14 37 21 44 27 53 C36 38 48 21 65 8" fill="none" stroke={RED_INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M10 35 C17 39 22 45 27 51" fill="none" stroke={RED_INK_DARK} strokeWidth={1.5} strokeLinecap="round" opacity={0.38} />
          </>
        ) : (
          <>
            <Path d="M12 12 C25 22 43 40 61 55" fill="none" stroke={RED_INK} strokeWidth={6.5} strokeLinecap="round" />
            <Path d="M61 9 C48 21 31 39 13 56" fill="none" stroke={RED_INK} strokeWidth={7} strokeLinecap="round" />
            <Path d="M14 14 C28 25 44 41 59 53" fill="none" stroke={RED_INK_DARK} strokeWidth={1.4} strokeLinecap="round" opacity={0.35} />
          </>
        )}
      </G>
    </Svg>
  );
}
