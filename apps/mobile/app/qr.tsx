// Mobile QR 스캐너 — expo-camera native (MLKit on Android, AVFoundation on iOS).
// Web jsQR보다 어두운 환경에서 훨씬 정확.
// QR 내용: https://aircondemocracy.com/p/{placeId}?via=qr 형식 예상.
// 권한 상태는 디자인 시스템(AppText/Button/EmptyState), 카메라 오버레이는 dark 유지.

import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScanLine, X } from 'lucide-react-native';
import { TOKEN, SPACE } from '@aircon/core';
import { AppText, Button, EmptyState, Loading, IconButton } from '../src/ui';

export default function QRScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <SafeAreaView style={styles.permSafe}>
        <Loading label="카메라를 준비하고 있어요" />
      </SafeAreaView>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permSafe} edges={['top', 'bottom']}>
        <View style={styles.permTop}>
          <IconButton label="닫기" variant="tonal" onPress={() => router.back()}>
            <X size={20} color={TOKEN.text1} />
          </IconButton>
        </View>
        <View style={styles.permBody}>
          <EmptyState
            icon={<ScanLine size={36} color={TOKEN.cold} />}
            title="카메라 권한이 필요해요"
            desc="QR 코드를 스캔하려면 카메라 접근을 허용해 주세요."
          />
          <View style={styles.permActions}>
            <Button label="권한 허용하기" onPress={requestPermission} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraRoot}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }: BarcodeScanningResult) => {
          if (scanned) return;
          setScanned(true);
          // URL 형식: https://aircondemocracy.com/p/{placeId}?via=qr 또는 단순 placeId
          try {
            const url = new URL(data);
            const m = url.pathname.match(/^\/p\/(.+?)\/?$/);
            if (m) {
              router.push(`/p/${m[1]}`);
              return;
            }
          } catch {
            // 단순 문자열 — placeId로 가정
          }
          router.push(`/p/${encodeURIComponent(data)}`);
        }}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none" edges={['top', 'bottom']}>
        <View style={styles.overlayTop}>
          <IconButton label="닫기" onPress={() => router.back()} style={styles.closeBtn}>
            <X size={22} color="#FFFFFF" />
          </IconButton>
        </View>

        <View style={styles.reticle} pointerEvents="none">
          <View style={styles.frame} />
          <AppText variant="body" weight="semibold" center color="#FFFFFF" style={styles.guideText}>
            QR 코드를 화면 안에 맞춰주세요
          </AppText>
        </View>

        {scanned && (
          <View style={styles.bottomBar}>
            <Button label="다시 스캔" variant="secondary" onPress={() => setScanned(false)} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // 권한 화면 — 밝은 디자인 시스템 캔버스
  permSafe: { flex: 1, backgroundColor: TOKEN.bg },
  permTop: { paddingHorizontal: SPACE.screenPadding, paddingTop: SPACE.s2 },
  permBody: { flex: 1, justifyContent: 'center', paddingBottom: SPACE.s8 },
  permActions: { paddingHorizontal: SPACE.screenPadding, marginTop: SPACE.s4 },

  // 카메라 화면 — dark 오버레이 유지
  cameraRoot: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  overlayTop: { paddingHorizontal: SPACE.screenPadding, paddingTop: SPACE.s2, alignItems: 'flex-start' },
  closeBtn: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: TOKEN.r.pill },
  reticle: { alignItems: 'center', gap: SPACE.s4 },
  frame: { width: 232, height: 232, borderRadius: TOKEN.r.xl, borderWidth: 3, borderColor: 'rgba(255,255,255,0.92)' },
  guideText: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, borderRadius: TOKEN.r.pill, overflow: 'hidden' },
  bottomBar: { paddingHorizontal: SPACE.screenPadding, paddingBottom: SPACE.s4 },
});
