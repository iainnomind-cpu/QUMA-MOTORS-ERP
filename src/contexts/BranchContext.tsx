import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface Branch {
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    manager_name: string | null;
    active: boolean;
    created_at: string;
    updated_at: string;
}

interface BranchContextType {
    currentBranch: Branch | null;
    allBranches: Branch[];
    selectedBranchId: string | null; // null = "Todas" (solo admin)
    isAllBranchesView: boolean;
    switchBranch: (branchId: string | null) => void;
    loading: boolean;
    refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const isAdmin = user?.role === 'admin';
    const isAllBranchesView = isAdmin && selectedBranchId === null;

    const loadBranches = async () => {
        try {
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .eq('active', true)
                .order('name');

            if (error) {
                console.error('Error loading branches:', error);
                return;
            }

            setAllBranches(data || []);
        } catch (err) {
            console.error('Exception loading branches:', err);
        }
    };

    const loadUserBranch = async () => {
        if (!user) return;

        try {
            // Fetch the user's branch_id from their profile
            const { data: profile, error } = await supabase
                .from('user_profiles')
                .select('branch_id')
                .eq('id', user.id)
                .single();

            if (error || !profile?.branch_id) {
                console.warn('User has no branch assigned, using first branch');
                if (allBranches.length > 0) {
                    setCurrentBranch(allBranches[0]);
                    setSelectedBranchId(isAdmin ? null : allBranches[0].id);
                }
                return;
            }

            const userBranch = allBranches.find(b => b.id === profile.branch_id);
            if (userBranch) {
                setCurrentBranch(userBranch);
                // Admin starts with "Todas" view; others see their branch
                setSelectedBranchId(isAdmin ? null : userBranch.id);
            }
        } catch (err) {
            console.error('Error loading user branch:', err);
        }
    };

    const refreshBranches = async () => {
        await loadBranches();
    };

    const switchBranch = (branchId: string | null) => {
        if (!isAdmin && branchId !== currentBranch?.id) {
            console.warn('Non-admin users cannot switch branches');
            return;
        }
        setSelectedBranchId(branchId);
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await loadBranches();
            setLoading(false);
        };
        init();
    }, []);

    useEffect(() => {
        if (user && allBranches.length > 0) {
            loadUserBranch();
        }
    }, [user, allBranches]);

    return (
        <BranchContext.Provider
            value={{
                currentBranch,
                allBranches,
                selectedBranchId,
                isAllBranchesView,
                switchBranch,
                loading,
                refreshBranches
            }}
        >
            {children}
        </BranchContext.Provider>
    );
}

export function useBranch() {
    const context = useContext(BranchContext);
    if (context === undefined) {
        throw new Error('useBranch must be used within a BranchProvider');
    }
    return context;
}

/**
 * Helper: returns the branch filter for Supabase queries.
 * If admin is viewing all branches, returns null (no filter).
 * Otherwise returns the selected branch ID.
 */
export function useBranchFilter(): string | null {
    const { selectedBranchId } = useBranch();
    return selectedBranchId;
}
