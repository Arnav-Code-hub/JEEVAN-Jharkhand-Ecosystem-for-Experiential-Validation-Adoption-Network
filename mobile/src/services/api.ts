import Constants from 'expo-constants';

const API_URL =
  Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

export interface CreateIssuePayload {
  title: string;
  description: string;
  category: string;
  citizenName: string;
  citizenPhone?: string;
  citizenEmail?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  district?: string;
  block?: string;
  imageUrls?: string[];
  voiceNoteUrl?: string;
  isEmergency?: boolean;
}

export interface IssueResponse extends CreateIssuePayload {
  id: string;
  status: string;
  channel: string;
  createdAt: string;
  updatedAt: string;
}

export async function submitIssue(payload: CreateIssuePayload): Promise<IssueResponse> {
  const url = `${API_URL}/api/citizens`;
  console.log(`[API] Submitting issue to ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to submit issue: ${response.status} - ${errorText}`);
  }

  return response.json();
}
