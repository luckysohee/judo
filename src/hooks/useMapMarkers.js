import { useMemo } from 'react';

// 1단계: 마커 ID의 고유성 재정의 (Composite Key)
export function useMapMarkers(allPlaces, selectedCurators, showAll, isCurator, user) {
  console.log("🔍 useMapMarkers 함수 시작:", {
    allPlacesLength: allPlaces?.length || 'undefined',
    selectedCuratorsLength: selectedCurators?.length || 'undefined',
    showAll,
    isCurator,
    selectedCuratorsType: typeof selectedCurators,
    allPlacesType: typeof allPlaces,
    user: user || 'NO_USER_OBJECT'
  });

  // Composite Key 생성: curatorId-placeId 조합
  const compositeMarkers = useMemo(() => {
    console.log("🔍 useMapMarkers 입력:", {
      allPlacesLength: allPlaces?.length || 0,
      selectedCurators: selectedCurators,
      selectedCuratorNames: Array.isArray(selectedCurators) ? selectedCurators.map(c => c?.name || 'NO_NAME') : 'NOT_ARRAY',
      showAll,
      isCurator,
      userId: user?.id || 'NO_USER'
    });

    if (showAll) {
      // 일반 모드: 비공개 필터링 적용
      const filtered = allPlaces
        .filter(place => {
          if (isCurator) {
            // 큐레이터는 자신의 장소와 공개 장소만 볼 수 있음
            const isOwnPlace = place.user_id === user?.id;
            const isPublicPlace = place.is_public !== false;
            console.log("🔍 큐레이터 필터링:", {
              placeName: place.name,
              placeUserId: place.user_id,
              currentUserId: user?.id,
              isOwnPlace,
              isPublicPlace,
              result: isOwnPlace || isPublicPlace
            });
            return isOwnPlace || isPublicPlace;
          }
          // 일반 사용자는 공개 장소만 볼 수 있음
          return place.is_public !== false;
        })
        .map(place => ({
          ...place,
          compositeKey: `place-${place.id}`, // 일반 모드는 place_id만으로 고유성 보장
          sourceType: 'public'
        }));
      
      console.log("🌍 showAll 모드 결과:", filtered.length);
      return filtered;
    }

    // 큐레이터 선택 모드: curatorId-placeId 조합으로 고유성 보장
    if (selectedCurators.length === 0) {
      console.log("⚠️ 선택된 큐레이터가 없음 - showAll 모드로 동작");
      // showAll이 true이면 모든 장소 표시, 아니면 빈 배열 반환
      if (showAll) {
        const filtered = allPlaces.filter(place => {
          // 큐레이터는 자신의 장소와 공개 장소만 볼 수 있음
          if (isCurator) {
            const isOwnPlace = place.user_id === user?.id;
            const isPublicPlace = place.is_public !== false;
            return isOwnPlace || isPublicPlace;
          }
          // 일반 사용자는 공개 장소만 볼 수 있음
          return place.is_public !== false;
        });
        
        const markers = filtered.map(place => ({
          ...place,
          compositeKey: `all-${place.id}`, // Composite Key
          sourceType: 'all',
          curatorName: 'all',
          originalPlaceId: place.id
        }));
        
        console.log("🌍 showAll 모드 결과:", markers.length);
        return markers;
      }
      return [];
    }

    console.log("🎯 큐레이터 선택 모드 시작:", {
      allPlacesLength: allPlaces.length,
      selectedCurators: selectedCurators
    });

    const filtered = allPlaces
      .filter(place => {
        // 선택된 큐레이터의 장소만 필터링
        const isSelected = selectedCurators.some(curatorName => {
          const primaryMatch = place.primaryCurator === curatorName;
          const curatorMatch = (place.curators || []).includes(curatorName);
          return primaryMatch || curatorMatch;
        });
        
        // 디버깅: 모든 장소의 정보 출력
        console.log("🔍 장소 필터링 체크:", {
          placeName: place.name,
          primaryCurator: place.primaryCurator,
          curators: place.curators,
          selectedCurators: selectedCurators,
          isSelected: isSelected
        });
        
        return isSelected;
      })
      .flatMap(place => {
        // 각 큐레이터별로 별도 마커 생성
        const placeCurators = (place.curators || [place.primaryCurator])
          .filter(curatorName => selectedCurators.includes(curatorName));
        
        return placeCurators.map(curatorName => ({
          ...place,
          compositeKey: `${curatorName}-${place.id}`, // Composite Key
          sourceType: 'curator',
          curatorName: curatorName,
          originalPlaceId: place.id
        }));
      });
    
    console.log("🎯 큐레이터 선택 모드 결과:", filtered.length);
    return filtered;
  }, [allPlaces, selectedCurators, showAll, isCurator, user]);

  // 2단계: 표시용 데이터와 액션용 데이터 분리
  const displayMarkers = useMemo(() => {
    // Composite Key를 기반으로 중복 제거
    const markerMap = new Map();
    
    compositeMarkers.forEach(marker => {
      // 같은 ID면 덮어쓰기 (최신 정보 유지)
      markerMap.set(marker.compositeKey, marker);
    });
    
    const result = Array.from(markerMap.values());
    console.log("📍 displayMarkers 생성:", result.length);
    return result;
  }, [compositeMarkers]);

  // 3단계: 마커 데이터 맵 생성
  const markerDataMap = useMemo(() => {
    const map = new Map();
    
    displayMarkers.forEach(marker => {
      map.set(marker.compositeKey, marker);
    });
    
    return map;
  }, [displayMarkers]);

  return {
    compositeMarkers,
    displayMarkers,
    markerDataMap
  };
}

// 장소 중심 데이터 처리 훅
export function usePlaceCentricData(displayMarkers) {
  const placeGroups = useMemo(() => {
    // 장소별 큐레이터 정보 그룹화
    const placeGroups = new Map();
    
    displayMarkers.forEach(place => {
      placeGroups.set(place.id, {
        ...place,
        curatorCount: place.curators.length,
        isMultiCurator: place.curators.length > 1,
        curatorNames: place.curators.join(', ')
      });
    });

    return {
      placeGroups,
      totalPlaces: placeGroups.size,
      multiCuratorPlaces: Array.from(placeGroups.values()).filter(p => p.isMultiCurator),
      singleCuratorPlaces: Array.from(placeGroups.values()).filter(p => !p.isMultiCurator)
    };
  }, [displayMarkers]);

  return placeGroups;
}
