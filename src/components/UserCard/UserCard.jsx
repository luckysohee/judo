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



const UserCard = ({ user, onClose, isVisible }) => {

  const [activeTab, setActiveTab] = useState('saved'); // 'saved' or 'following'

  const [savedPlaces, setSavedPlaces] = useState([]);

  const [followingCurators, setFollowingCurators] = useState([]);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    if (isVisible && user) {

      loadUserData();

    }

  }, [isVisible, user]);



  const loadUserData = async () => {

    try {

      setLoading(true);

      

      // 1. 저장한 장소 불러오기

      const { data: savedData, error: savedError } = await supabase

        .from('user_saved_places')

        .select('*')

        .eq('user_id', user.id)

        .order('created_at', { ascending: false })

        .limit(10);



      if (savedError) {

        console.error('저장된 장소 로드 오류:', savedError);

      } else {

        setSavedPlaces(savedData || []);

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



  if (!isVisible) return null;



  return (

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

        maxWidth: '600px',

        maxHeight: '80vh',

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

            ❤️ 내 저장 ({savedPlaces.length})

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

              transition: 'all 0.2s ease'

            }}

          >

            🤝 팔로우 큐레이터 ({followingCurators.length})

          </button>

        </div>



        {/* 탭 내용 */}

        <div style={{

          padding: '20px',

          maxHeight: '300px',

          overflowY: 'auto'

        }}>

          {loading ? (

            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>

              로딩 중...

            </div>

          ) : activeTab === 'saved' ? (

            savedPlaces.length === 0 ? (

              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>

                아직 저장한 장소가 없습니다.

              </div>

            ) : (

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {savedPlaces.map((saved) => (

                  <div

                    key={saved.id}

                    style={{

                      backgroundColor: 'rgba(255, 255, 255, 0.05)',

                      border: '1px solid rgba(255, 255, 255, 0.1)',

                      borderRadius: '8px',

                      padding: '12px',

                      cursor: 'pointer',

                      transition: 'all 0.2s ease'

                    }}

                  >

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                      <div style={{ flex: 1, minWidth: 0 }}>

                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>

                          {saved.places.name}

                        </h4>

                        <p style={{ fontSize: '12px', color: '#999', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>

                          {saved.places.address}

                        </p>

                        <div style={{ fontSize: '11px', color: '#3498DB' }}>

                          @{saved.places.curator?.username || 'unknown'}

                        </div>

                      </div>

                      <button

                        onClick={(e) => {

                          e.stopPropagation();

                          handleRemoveSaved(saved.place_id);

                        }}

                        style={{

                          padding: '4px 8px',

                          backgroundColor: '#e74c3c',

                          color: 'white',

                          border: 'none',

                          borderRadius: '4px',

                          fontSize: '11px',

                          fontWeight: '600',

                          cursor: 'pointer',

                          flexShrink: 0

                        }}

                      >

                        삭제

                      </button>

                    </div>

                  </div>

                ))}

              </div>

            )

          ) : (

            followingCurators.length === 0 ? (

              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>

                아직 팔로우한 큐레이터가 없습니다.

              </div>

            ) : (

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {followingCurators.map((curator) => (

                  <div

                    key={curator.id}

                    style={{

                      backgroundColor: 'rgba(255, 255, 255, 0.05)',

                      border: '1px solid rgba(255, 255, 255, 0.1)',

                      borderRadius: '8px',

                      padding: '12px',

                      cursor: 'pointer',

                      transition: 'all 0.2s ease'

                    }}

                  >

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                      <div style={{ flex: 1, minWidth: 0 }}>

                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>

                          @{curator.username}

                        </h4>

                        <p style={{ fontSize: '12px', color: '#999', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>

                          {curator.bio || '큐레이터'}

                        </p>

                        <div style={{ fontSize: '11px', color: '#3498DB' }}>

                          {curator.stats?.saveCount || 0} 저장

                        </div>

                      </div>

                      <button

                        onClick={(e) => {

                          e.stopPropagation();

                          handleUnfollow(curator.id);

                        }}

                        style={{

                          padding: '4px 8px',

                          backgroundColor: '#e74c3c',

                          color: 'white',

                          border: 'none',

                          borderRadius: '4px',

                          fontSize: '11px',

                          fontWeight: '600',

                          cursor: 'pointer',

                          flexShrink: 0

                        }}

                      >

                        언팔로우

                      </button>

                    </div>

                  </div>

                ))}

              </div>

            )

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

          {activeTab === 'saved' ? (

            // 내 저장 탭: 새 폴더 만들기만 보이기

            <button

              style={{

                width: '100%',

                padding: '10px',

                backgroundColor: '#3498DB',

                color: 'white',

                border: 'none',

                borderRadius: '6px',

                fontSize: '13px',

                fontWeight: '600',

                cursor: 'pointer'

              }}

              onClick={() => {

                // TODO: 새 폴더 만들기 기능 구현

                alert('새 폴더 만들기 기능은 곧 구현됩니다!');

              }}

            >

              📁 새 폴더 만들기

            </button>

          ) : (

            // 팔로우 큐레이터 탭: 팔로우 관리만 보이기

            <button

              style={{

                width: '100%',

                padding: '10px',

                backgroundColor: '#3498DB',

                color: 'white',

                border: 'none',

                borderRadius: '6px',

                fontSize: '13px',

                fontWeight: '600',

                cursor: 'pointer'

              }}

              onClick={() => {

                // TODO: 팔로우 관리 기능 구현

                alert('팔로우 관리 기능은 곧 구현됩니다!');

              }}

            >

              🤝 팔로우 관리

            </button>

          )}

        </div>

      </div>

    </div>

  );

};



export default UserCard;

