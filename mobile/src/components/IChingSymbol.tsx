import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Circle, Line as SvgLine } from 'react-native-svg';

interface IChingSymbolProps {
  lines: number[]; // Alttan üste doğru 6 çizgi (0. index = en alt)
  size?: number;
  color?: string; // Gold-kahve tonu için varsayılan: #C69A6B
  changingYinColor?: string; // Kesikten düze giden (Aydınlanma/Güneş): Fildişi Beyazı
  changingYangColor?: string; // Düzden kesiğe giden (İçe dönüş/Ay): Mistik Gümüş
}

// 6 = Eski Yin (Değişen Yin)
// 8 = Genç Yin (Sabit Yin)
// 9 = Eski Yang (Değişen Yang)
// 7 = Genç Yang (Sabit Yang)
// 0 = Yin (Binary string'den geliyorsa)
// 1 = Yang (Binary string'den geliyorsa)

export default function IChingSymbol({ 
  lines, 
  size = 60, 
  color = '#C69A6B',
  changingYinColor = '#FFF5E8',
  changingYangColor = '#939AB0'
}: IChingSymbolProps) {
  const lineSpacing = size / 6;
  const strokeWidth = lineSpacing * 0.45;
  
  // Çizgiler alttan üste doğru numaralandırılır, ancak ekranda üstten alta çizilir (index 5'ten 0'a)
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {[...lines].reverse().map((val, idx) => {
          const y = idx * lineSpacing + (lineSpacing - strokeWidth) / 2;
          const isYin = val === 6 || val === 8 || val === 0;
          const isYang = val === 9 || val === 7 || val === 1;
          const isChangingYin = val === 6;
          const isChangingYang = val === 9;
          
          let lineFill = color;
          if (isChangingYin) lineFill = changingYinColor;
          if (isChangingYang) lineFill = changingYangColor;
          
          if (isYang) {
            return (
              <React.Fragment key={idx}>
                <Rect x="0" y={y} width={size} height={strokeWidth} fill={lineFill} rx={2} />
              </React.Fragment>
            );
          } else if (isYin) {
            const gap = size * 0.15;
            const segmentWidth = (size - gap) / 2;
            return (
              <React.Fragment key={idx}>
                <Rect x="0" y={y} width={segmentWidth} height={strokeWidth} fill={lineFill} rx={2} />
                <Rect x={segmentWidth + gap} y={y} width={segmentWidth} height={strokeWidth} fill={lineFill} rx={2} />
              </React.Fragment>
            );
          }
          return null;
        })}
      </Svg>
    </View>
  );
}
