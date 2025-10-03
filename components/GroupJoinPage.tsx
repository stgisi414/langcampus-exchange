import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as groupService from '../services/groupService';
import { auth } from '../firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';
import GroupNotFound from './GroupNotFound';

const GroupJoinPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return; // Wait until Firebase has confirmed the user's login status.
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      // This should be handled by the main router, but as a safeguard,
      // we navigate to home, which will show the login screen.
      navigate('/');
      return;
    }

    if (!groupId) {
      setError("No group ID was provided in the link.");
      setIsLoading(false);
      return;
    }

    const checkAndJoinGroup = async () => {
      try {
        const groupData = await groupService.getGroupById(groupId);

        if (!groupData) {
          setError("This group does not exist or is unavailable.");
          return;
        }

        if (groupData.members.includes(currentUser.uid)) {
          // User is already a member, just go home.
          navigate('/');
          return;
        }

        if (groupData.members.length >= 3) {
          setError("This group is full.");
          return;
        }

        // --- Automatic Join ---
        // If we reach here, the user is logged in, the group exists, and it's not full.
        // We will automatically join them to the group.
        await groupService.joinGroup(groupId, currentUser.uid);
        navigate('/'); // On success, redirect to the homepage. The main app will see the active group and open the chat.

      } catch (e) {
        console.error("Error checking or joining group:", e);
        setError("An error occurred. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    checkAndJoinGroup();

  }, [groupId, authLoading, navigate]);

  if (isLoading || authLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-500">Joining group...</p>
      </div>
    );
  }

  // If there was an error after trying to join, we show the "Not Found" page.
  if (error) {
    return <GroupNotFound />;
  }

  // This component's main job is to process and redirect, so it doesn't need to render anything on success.
  return null;
};

export default GroupJoinPage;