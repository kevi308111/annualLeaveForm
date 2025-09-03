import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  // 1. Verify user session and admin role
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: employeeId } = params;

  if (!employeeId) {
    return NextResponse.json({ message: 'Employee ID is required' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const defaultPassword = '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const { error: updateError } = await supabaseAdmin
      .from('Employee')
      .update({ password: hashedPassword })
      .eq('id', employeeId);

    if (updateError) {
      console.error('Error resetting password:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 });

  } catch (error: any) {
    console.error('Unhandled error in password reset API route:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
