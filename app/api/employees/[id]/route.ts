import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path if necessary
import { createClient } from '@supabase/supabase-js'; // Import Supabase client

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  console.log('API Route: Session:', session); // Log session
  console.log('API Route: User Role:', session?.user?.role); // Log user role

  // 1. Verify user session and admin role
  if (!session || session.user?.role !== 'admin') {
    console.log('API Route: Unauthorized attempt - Session or Role missing/incorrect');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = params.id;

  if (!employeeId) {
    return NextResponse.json({ message: 'Employee ID is required' }, { status: 400 });
  }

  try {
    // 2. Initialize Supabase with service_role_key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Perform the delete operation
    const { error } = await supabaseAdmin
      .from('Employee')
      .delete()
      .eq('id', employeeId);

    if (error) {
      console.error('Error deleting employee from API route:', error);
      return NextResponse.json({ message: 'Failed to delete employee', error: error.message }, { status: 500 });
    }

    // 4. Return success response
    return NextResponse.json({ message: 'Employee deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error('Unexpected error in API route:', error);
    return NextResponse.json({ message: 'Internal server error', error: error.message }, { status: 500 });
  }
}