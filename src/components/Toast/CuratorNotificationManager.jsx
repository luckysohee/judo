import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Toast from './Toast';

/** followingUserId = auth.users id of the person being followed (프로필 주인) */
const CuratorNotificationManager = ({ followingUserId }) => {
  const [notifications, setNotifications] = useState([]);

  // 로그인 시점에 읽지 않은 팔로워 알림 처리
  useEffect(() => {
    if (!followingUserId) return;

    const fetchUnreadFollowers = async () => {
      try {
        console.log('🔍 팔로우 대상 user_id:', followingUserId);
        
        const { data: unreadFollows, error: unreadError } = await supabase
          .from('user_profile_follows')
          .select('follower_id, created_at')
          .eq('following_id', followingUserId)
          .eq('is_read', false)
          .order('created_at', { ascending: false });

        console.log('🔍 읽지 않은 팔로우 데이터:', { unreadFollows, unreadError });

        if (unreadError) {
          console.error('읽지 않은 팔로워 조회 실패:', unreadError);
          return;
        }

        if (unreadFollows && unreadFollows.length > 0) {
          console.log('🔍 읽지 않은 팔로우 수:', unreadFollows.length);
          
          const count = unreadFollows.length;
          const message = count === 1 
            ? `✨ 새로운 팔로워가 나를 팔로우했습니다! 👤`
            : `🚀 ${count}명의 새로운 팔로워가 있습니다!`;

          const newNotification = {
            id: Date.now(),
            type: 'follow_summary',
            message,
            count,
            followers: unreadFollows,
            createdAt: new Date().toISOString()
          };

          setNotifications(prev => [newNotification, ...prev]);

          const { error: updateError } = await supabase
            .from('user_profile_follows')
            .update({ is_read: true })
            .eq('following_id', followingUserId)
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
  }, [followingUserId]);

  // 실시간 팔로우 알림 구독
  useEffect(() => {
    if (!followingUserId) return;

    const channel = supabase
      .channel(`follow_notifications:${followingUserId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'user_profile_follows',
          filter: `following_id=eq.${followingUserId}`
        },
        async (payload) => {
          console.log('🔔 새 팔로우 알림:', payload);
          
          const newNotification = {
            id: Date.now(),
            type: 'follow_single',
            message: `✨ 새로운 팔로워가 나를 팔로우했습니다! 👤`,
            userId: payload.new.follower_id,
            createdAt: payload.new.created_at
          };
          
          setNotifications(prev => [newNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [followingUserId]);

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
