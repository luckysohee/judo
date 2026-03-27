import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Toast from './Toast';

const CuratorNotificationManager = ({ curatorId }) => {
  const [notifications, setNotifications] = useState([]);

  // 로그인 시점에 읽지 않은 팔로워 알림 처리
  useEffect(() => {
    if (!curatorId) return;

    const fetchUnreadFollowers = async () => {
      try {
        console.log('🔍 큐레이터 ID:', curatorId);
        
        // 읽지 않은 팔로우 목록 조회 (users 테이블 조인 없이)
        const { data: unreadFollows, error: unreadError } = await supabase
          .from('user_follows')
          .select('user_id, created_at')
          .eq('curator_id', curatorId)
          .eq('is_read', false)
          .order('created_at', { ascending: false });

        console.log('🔍 읽지 않은 팔로우 데이터:', { unreadFollows, unreadError });

        if (unreadError) {
          console.error('읽지 않은 팔로워 조회 실패:', unreadError);
          return;
        }

        if (unreadFollows && unreadFollows.length > 0) {
          console.log('🔍 읽지 않은 팔로우 수:', unreadFollows.length);
          
          // 간단한 알림 메시지 생성
          const count = unreadFollows.length;
          const message = count === 1 
            ? `✨ 새로운 팔로워가 큐레이터님을 팔로우했습니다! 👤`
            : `🚀 ${count}명의 새로운 팔로워가 큐레이터님을 팔로우합니다!`;

          // 알림 추가
          const newNotification = {
            id: Date.now(),
            type: 'follow_summary',
            message,
            count,
            followers: unreadFollows,
            createdAt: new Date().toISOString()
          };

          setNotifications(prev => [newNotification, ...prev]);

          // 읽음 처리
          const { error: updateError } = await supabase
            .from('user_follows')
            .update({ is_read: true })
            .eq('curator_id', curatorId)
            .eq('is_read', false);

          if (updateError) {
            console.error('읽음 처리 실패:', updateError);
          } else {
            console.log('✅ 읽음 처리 완료');
          }
        } else {
          console.log('🔍 읽지 않은 팔로우 없음');
        }
      } catch (error) {
        console.error('팔로워 알림 처리 오류:', error);
      }
    };

    fetchUnreadFollowers();
  }, [curatorId]);

  // 실시간 팔로우 알림 구독
  useEffect(() => {
    if (!curatorId) return;

    const channel = supabase
      .channel(`follow_notifications:${curatorId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'user_follows',
          filter: `curator_id=eq.${curatorId}`
        },
        async (payload) => {
          console.log('🔔 새 팔로우 알림:', payload);
          
          // 단일 팔로우 알림
          const newNotification = {
            id: Date.now(),
            type: 'follow_single',
            message: `✨ 새로운 팔로워가 큐레이터님을 팔로우했습니다! 👤`,
            userId: payload.new.user_id,
            createdAt: payload.new.created_at
          };
          
          setNotifications(prev => [newNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [curatorId]);

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  return (
    <>
      {notifications.map(notif => (
        <Toast
          key={notif.id}
          message={notif.message}
          type="info"
          duration={5000}
          onClose={() => removeNotification(notif.id)}
        />
      ))}
    </>
  );
};

export default CuratorNotificationManager;
