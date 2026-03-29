import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);

// 팔로우 큐레이터 컴팩트 스타일
const curatorCardStyles = {
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  info: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  avatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#3498DB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: 'white',
    flexShrink: 0
  },
  details: {
    flex: 1,
    minWidth: 0
  },
  name: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '1px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  meta: {
    fontSize: '10px',
    color: '#999',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  unfollowButton: {
    padding: '4px 8px',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0
  }
};

// SaveModal 스타일 동일하게 적용
const modalStyles = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  folderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    justifyContent: 'center'
  },
  folderButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 4px',
    border: '2px solid',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '45px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    position: 'relative',
    zIndex: 10
  },
  addFolderButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 4px',
    border: '2px dashed rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '45px',
    color: 'rgba(255, 255, 255, 0.6)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    position: 'relative',
    zIndex: 10
  }
};

const UserCard = ({ user, onClose, isVisible }) => {
  const [activeTab, setActiveTab] = useState('saved');
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [followingCurators, setFollowingCurators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCurator, setSelectedCurator] = useState(null);

  useEffect(() => {
    if (isVisible && user) {
      loadUserData();
    }
  }, [isVisible, user]);

  // 팔로우한 큐레이터 필터링 함수
  const getFilteredCurators = () => {
    if (!searchQuery.trim()) {
      return followingCurators;
    }

    return followingCurators.filter(curator => {
      const username = curator.username?.toLowerCase() || '';
      const displayName = curator.display_name?.toLowerCase() || '';
      const bio = curator.bio?.toLowerCase() || '';
      const searchLower = searchQuery.toLowerCase();
      
      return username.includes(searchLower) || 
             displayName.includes(searchLower) || 
             bio.includes(searchLower);
    });
  };

  // 큐레이터 프로필 불러오기
  const loadCuratorProfile = async (curator) => {
    try {
      // 큐레이터 상세 정보 불러오기
      const { data: curatorData, error: curatorError } = await supabase
        .from('curators')
        .select('*')
        .eq('username', curator.username)
        .single();

      if (curatorError) {
        console.error('큐레이터 정보 로드 오류:', curatorError);
        return;
      }

      // 큐레이터의 저장된 장소 불러오기
      const { data: savedPlaces, error: placesError } = await supabase
        .from('user_saved_places')
        .select(`
          *,
          places (*)
        `)
        .eq('user_id', curatorData.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (placesError) {
        console.error('큐레이터 저장 장소 로드 오류:', placesError);
      }

      // 큐레이터의 팔로워 수 불러오기
      const { count: followerCount, error: followerError } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('curator_id', curatorData.id);

      setSelectedCurator({
        ...curatorData,
        savedPlaces: savedPlaces || [],
        stats: {
          ...curatorData.stats,
          followerCount: followerCount || 0
        }
      });

    } catch (error) {
      console.error('큐레이터 프로필 로드 오류:', error);
    }
  };

  const loadUserData = async () => {
    try {
      setLoading(true);

      // 1. 저장한 장소 불러오기 (폴더 정보 포함)
      const { data: savedData, error: savedError } = await supabase
        .from('user_saved_places')
        .select(`
          *,
          user_saved_place_folders (
            folder_key,
            system_folders (
              name,
              color,
              icon
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('UserCard - savedData:', savedData);
      console.log('UserCard - savedError:', savedError);

      if (savedError) {
        console.error('저장된 장소 로드 오류:', savedError);
        setSavedPlaces([]);
      } else {
        // 폴더별로 그룹화
        const groupedByFolder = {};
        
        // 기본 폴더 7개 초기화
        const SYSTEM_FOLDERS = [
          { key: 'after_party', name: '2차', color: '#FF8C42', icon: '🍺' },
          { key: 'date', name: '데이트', color: '#FF69B4', icon: '💘' },
          { key: 'hangover', name: '해장', color: '#87CEEB', icon: '🥣' },
          { key: 'solo', name: '혼술', color: '#9B59B6', icon: '👤' },
          { key: 'group', name: '회식', color: '#F1C40F', icon: '👥' },
          { key: 'must_go', name: '찐맛집', color: '#27AE60', icon: '🌟' },
          { key: 'terrace', name: '야외/뷰', color: '#2C3E50', icon: '🌅' }
        ];
        
        SYSTEM_FOLDERS.forEach(folder => {
          groupedByFolder[folder.key] = {
            folderInfo: folder,
            places: []
          };
        });
        
        savedData?.forEach(saved => {
          if (saved.user_saved_place_folders && saved.user_saved_place_folders.length > 0) {
            saved.user_saved_place_folders.forEach(folder => {
              const folderKey = folder.folder_key;
              if (groupedByFolder[folderKey]) {
                groupedByFolder[folderKey].places.push(saved);
              }
            });
          }
        });

        console.log('UserCard - 그룹화된 데이터:', groupedByFolder);
        setSavedPlaces(groupedByFolder);
      }

      // 2. 팔로우한 큐레이터 불러오기
      const { data: followingData, error: followingError } = await supabase
        .from('user_follows')
        .select('*')
        .eq('user_id', user.id);

      console.log("🔍 UserCard - 팔로우 데이터:", followingData);
      console.log("🔍 UserCard - 현재 user.id:", user.id);

      if (followingError) {
        console.error('팔로우 큐레이터 로드 오류:', followingError);
        setFollowingCurators([]);
      } else if (followingData && followingData.length > 0) {
        // 각 curator_id에 해당하는 큐레이터 정보 가져오기
        const curatorIds = followingData.map(f => f.curator_id).filter(Boolean);
        
        if (curatorIds.length > 0) {
          // UUID와 문자열을 분리
          const uuidIds = curatorIds.filter(id => id.includes('-'));
          const stringIds = curatorIds.filter(id => !id.includes('-'));
          
          let curatorData = [];
          
          // UUID 기반 조회
          if (uuidIds.length > 0) {
            const { data: uuidData, error: uuidError } = await supabase
              .from('curators')
              .select('*')
              .in('id', uuidIds);
            
            if (!uuidError && uuidData) {
              curatorData = [...curatorData, ...uuidData];
            } else if (uuidError) {
              console.error('UUID 큐레이터 정보 로드 오류:', uuidError);
            }
          }
          
          // 문자열(username) 기반 조회
          if (stringIds.length > 0) {
            const { data: stringData, error: stringError } = await supabase
              .from('curators')
              .select('*')
              .or(`username.in.(${stringIds.map(id => `'${id}'`).join(',')}),slug.in.(${stringIds.map(id => `'${id}'`).join(',')})`);
            
            if (!stringError && stringData) {
              curatorData = [...curatorData, ...stringData];
            } else if (stringError) {
              console.error('문자열 큐레이터 정보 로드 오류:', stringError);
            }
          }
          
          // 팔로우 데이터와 큐레이터 정보 결합
          const enrichedData = followingData.map(follow => {
            const curator = uuidIds.includes(follow.curator_id)
              ? curatorData.find(c => c.id === follow.curator_id)
              : curatorData.find(c => c.username === follow.curator_id) || 
                curatorData.find(c => c.slug === follow.curator_id);
            
            console.log("🔍 큐레이터 매칭:", {
              follow_curator_id: follow.curator_id,
              found_curator: curator,
              curator_username: curator?.username,
              curator_slug: curator?.slug
            });
            
            return curator || follow;
          });
          
          setFollowingCurators(enrichedData);
        } else {
          setFollowingCurators(followingData);
        }
      } else {
        setFollowingCurators([]);
      }

    } catch (error) {
      console.error('사용자 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSaved = async (placeId) => {
    try {
      const { error } = await supabase
        .from('user_saved_places')
        .delete()
        .eq('user_id', user.id)
        .eq('place_id', placeId);

      if (error) {
        console.error('저장 삭제 오류:', error);
        alert('저장 삭제에 실패했습니다.');
      } else {
        setSavedPlaces(prev => prev.filter(p => p.place_id !== placeId));
      }
    } catch (error) {
      console.error('저장 삭제 처리 오류:', error);
    }
  };

  const handleUnfollow = async (curatorId) => {
    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('user_id', user.id)
        .eq('curator_id', curatorId);

      if (error) {
        console.error('언팔로우 오류:', error);
        alert('언팔로우에 실패했습니다.');
      } else {
        setFollowingCurators(prev => prev.filter(c => c.id !== curatorId));
      }
    } catch (error) {
      console.error('언팔로우 처리 오류:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '0'
      }}>
        <div style={{
          backgroundColor: '#222',
          borderRadius: '16px 16px 0 0',
          width: '100%',
          maxWidth: '500px',
          height: 'auto',
          overflow: 'hidden',
          position: 'relative',
          animation: 'slideUp 0.3s ease-out'
        }}>
          {/* 드래그 핸들 */}
          <div style={{
            width: '40px',
            height: '4px',
            backgroundColor: '#666',
            borderRadius: '2px',
            margin: '12px auto 8px',
            cursor: 'grab'
          }} />

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '20px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#999',
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            ×
          </button>

          {/* 프로필 정보 */}
          <div style={{
            padding: '20px 30px 10px',
            borderBottom: '1px solid #333'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: '#3498DB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                color: 'white',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                {user.user_metadata?.image ? (
                  <img src={user.user_metadata.image} alt="프로필" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.user_metadata?.display_name || user.user_metadata?.username || '사용자'}
                </div>
                <div style={{ fontSize: '14px', color: '#3498DB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  @{user.user_metadata?.username || user.email?.split('@')[0]}
                </div>
                {user.user_metadata?.bio && (
                  <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.3', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.user_metadata.bio}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 탭 버튼 */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #333'
          }}>
            <button
              onClick={() => setActiveTab('saved')}
              style={{
                flex: 1,
                padding: '14px',
                backgroundColor: activeTab === 'saved' ? '#3498DB' : 'transparent',
                color: activeTab === 'saved' ? 'white' : '#999',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ❤️ 내 저장 ({Object.keys(savedPlaces).length})
            </button>
            <button
              onClick={() => setActiveTab('following')}
              style={{
                flex: 1,
                padding: '14px',
                backgroundColor: activeTab === 'following' ? '#3498DB' : 'transparent',
                color: activeTab === 'following' ? 'white' : '#999',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              🤝 팔로우 큐레이터 ({followingCurators.length})
              {activeTab === 'following' && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSearch(!showSearch);
                  }}
                  style={{
                    backgroundColor: showSearch ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)'
                  }}
                >
                  🔍
                </div>
              )}
            </button>
          </div>

          {/* 탭 내용 */}
          <div style={{
            padding: '20px',
            height: '150px', // 300px에서 150px로 50% 축소
            overflowY: 'auto'
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                로딩 중...
              </div>
            ) : activeTab === 'saved' ? (
              Object.keys(savedPlaces).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  아직 저장한 장소가 없습니다.
                </div>
              ) : (
                <div style={modalStyles.section}>
                  {/* 폴더 그리드 - 2층으로 배치 */}
                  <div style={modalStyles.folderGrid}>
                    {Object.entries(savedPlaces).map(([folderKey, folderData]) => (
                      <button
                        key={folderKey}
                        onClick={() => {
                          // TODO: 폴더 클릭 시 해당 폴더 장소만 필터링
                          console.log('폴더 클릭:', folderData.folderInfo?.name);
                        }}
                        style={{
                          ...modalStyles.folderButton,
                          borderColor: folderData.folderInfo?.color || '#666',
                          backgroundColor: folderData.places.length > 0 ? 
                            `${folderData.folderInfo?.color}20` : 'transparent'
                        }}
                      >
                        <span style={{ fontSize: '14px', marginBottom: '2px' }}>
                          {folderData.folderInfo?.icon}
                        </span>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 'bold',
                          color: folderData.places.length > 0 ? 
                            folderData.folderInfo?.color : '#999',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          {folderData.folderInfo?.name}
                          <span style={{ 
                            fontSize: '8px', 
                            color: '#666',
                            fontWeight: 'normal'
                          }}>
                            ({folderData.places.length})
                          </span>
                        </span>
                      </button>
                    ))}
                    
                    {/* 새 폴더 만들기 버튼 */}
                    <button
                      onClick={() => {
                        // TODO: 새 폴더 만들기 기능
                        alert('새 폴더 만들기 기능은 곧 구현됩니다!');
                      }}
                      style={modalStyles.addFolderButton}
                    >
                      <span style={{ fontSize: '14px' }}>+</span>
                      <span style={{ fontSize: '10px', fontWeight: 'bold' }}>
                        새 폴더
                      </span>
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 검색 입력창 */}
                {showSearch && (
                  <div style={{ paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="팔로우한 큐레이터 검색..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      autoFocus
                    />
                  </div>
                )}
                
                {/* 큐레이터 리스트 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {getFilteredCurators().length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                      {searchQuery ? '검색 결과가 없습니다' : '아직 팔로우한 큐레이터가 없습니다.'}
                    </div>
                  ) : (
                    getFilteredCurators().map((curator) => (
                      <div
                        key={curator.id}
                        style={curatorCardStyles.card}
                      >
                        <div style={curatorCardStyles.info}>
                          <div style={curatorCardStyles.avatar}>
                            {curator.username?.charAt(0)?.toUpperCase() || '👤'}
                          </div>
                          <div style={curatorCardStyles.details}>
                          <div 
                            style={{
                              ...curatorCardStyles.name,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              textDecorationColor: 'rgba(255, 255, 255, 0.3)'
                            }}
                            onClick={() => loadCuratorProfile(curator)}
                          >
                            @{curator.username || 'unknown'}
                          </div>
                          <div style={curatorCardStyles.meta}>
                            {curator.bio ? `${curator.bio.slice(0, 20)}...` : '큐레이터'} • {curator.stats?.saveCount || 0} 저장
                          </div>
                        </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnfollow(curator.id);
                          }}
                          style={curatorCardStyles.unfollowButton}
                        >
                          언팔로우
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 하단 버튼 */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #333',
            display: 'flex',
            gap: '12px',
            backgroundColor: '#222'
          }}>
            {/* 하단 버튼 없음 - 탭에 돋보기 버튼으로 이동 */}
          </div>
        </div>
      </div>

      {/* 큐레이터 프로필 모달 */}
      {selectedCurator && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'rgba(18, 18, 18, 0.96)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 14px 30px rgba(0, 0, 0, 0.32)'
          }}>
            {/* 큐레이터 프로필 헤더 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>
                큐레이터 프로필
              </h3>
              <button
                onClick={() => setSelectedCurator(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            {/* 큐레이터 정보 */}
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: '#3498DB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {selectedCurator.username?.charAt(0)?.toUpperCase() || '👤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                    @{selectedCurator.username}
                  </div>
                  <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '4px' }}>
                    {selectedCurator.display_name || '큐레이터'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    팔로워 {selectedCurator.stats?.followerCount || 0}명 • 저장 {selectedCurator.stats?.saveCount || 0}개
                  </div>
                </div>
              </div>

              {selectedCurator.bio && (
                <div style={{ 
                  fontSize: '14px', 
                  color: '#ccc', 
                  lineHeight: '1.4', 
                  marginBottom: '20px',
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px'
                }}>
                  {selectedCurator.bio}
                </div>
              )}

              {/* 저장된 장소 목록 */}
              <div>
                <h4 style={{ color: 'white', fontSize: '14px', marginBottom: '12px' }}>
                  저장한 장소 ({selectedCurator.savedPlaces?.length || 0})
                </h4>
                <div style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {selectedCurator.savedPlaces?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                      저장한 장소가 없습니다
                    </div>
                  ) : (
                    selectedCurator.savedPlaces.map((saved) => (
                      <div
                        key={saved.id}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '12px'
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                          {saved.places?.name || '정보 없음'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {saved.places?.address || '주소 정보 없음'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserCard;
