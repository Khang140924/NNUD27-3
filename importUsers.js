const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const User = require('./schemas/users');
const Role = require('./schemas/roles');

// Thiết lập Transporter để gửi mail (có thể tận dụng Mailtrap hoặc Gmail tuỳ cấu hình của bạn)
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 25,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "51a3800eba3940", // Điền user của Mailtrap hoặc SMTP của bạn
        pass: "a1eaae4120f36c", // Điền pass
    },
});

// Hàm tạo password ngẫu nhiên 16 ký tự
function generatePassword(length = 16) {
    return crypto.randomBytes(length).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, length).padEnd(length, 'a');
}

// Hàm gửi email cho user
async function sendPasswordEmail(to, username, password) {
    const mailOptions = {
        from: 'admin@hehehe.com',
        to: to,
        subject: "Tài khoản của bạn đã được tạo",
        text: `Chào ${username},\n\nTài khoản của bạn đã được tạo thành công.\nPassword của bạn là: ${password}\n\nVui lòng bảo mật thông tin này.`,
        html: `Chào ${username},<br><br>Tài khoản của bạn đã được tạo thành công.<br>Password của bạn là: <b>${password}</b><br><br>Vui lòng bảo mật thông tin này.`,
    };
    await transporter.sendMail(mailOptions);
}

async function importUsers() {
    try {
        // Kết nối Database
        await mongoose.connect('mongodb+srv://lamkhang8976:Khang1409@cluster0.pumuz5r.mongodb.net/?appName=Cluster0');
        console.log("Đã kết nối cơ sở dữ liệu (Successfully connected to database).");

        // Tìm role 'user'
        let roleUser = await Role.findOne({ name: 'user' });
        if (!roleUser) {
            console.log("Không tìm thấy role 'user', đang tự động tạo mới...");
            roleUser = new Role({ name: 'user', description: 'Default user role' });
            await roleUser.save();
            console.log("Đã tạo role 'user' thành công.");
        }

        // Đọc file users_data.txt
        const dataPath = path.join(__dirname, 'users_data.txt');
        const fileContent = fs.readFileSync(dataPath, 'utf-8');

        // Tách từng dòng và lọc các dòng trống
        const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

        // Bỏ qua dòng tiêu đề nếu có
        if (lines[0].includes('username') && lines[0].includes('email')) {
            lines.shift();
        }

        for (const line of lines) {
            // Tách username và email dựa vào khoảng trắng (tab hoặc space)
            const [username, email] = line.split(/\s+/);

            if (!username || !email) continue;

            try {
                // Kiểm tra xem user đã tồn tại chưa
                const existingUser = await User.findOne({
                    $or: [{ username: username }, { email: email }]
                });

                if (existingUser) {
                    console.log(`User ${username} or email ${email} đã tồn tại (Already exists). Bỏ qua.`);
                    continue;
                }

                // Tạo mật khẩu ngẫu nhiên
                const rawPassword = generatePassword(16);

                // Tạo user mới
                const newUser = new User({
                    username: username,
                    email: email,
                    password: rawPassword, // Middleware pre('save') trong user Schema sẽ tự động hash password này
                    role: roleUser._id
                });

                await newUser.save();
                console.log(`Đã tạo thành công user (Successfully created user): ${username}`);

                // Gửi email chứa password
                try {
                    await sendPasswordEmail(email, username, rawPassword);
                    console.log(`Đã gửi email thành công tới (Successfully sent email to): ${email}`);
                } catch (mailError) {
                    console.log(`Lỗi khi gửi email tới (Error sending email to) ${email}:`, mailError.message);
                }
                
                // Thêm độ trễ (delay) 1.5 giây để tránh lỗi "Too many emails per second" của Mailtrap
                await new Promise(resolve => setTimeout(resolve, 1500));

            } catch (err) {
                console.error(`Lỗi khi xử lý user ${username}:`, err.message);
            }
        }

        console.log("Hoàn thành quá trình import (Import process completed).");
        process.exit(0);

    } catch (error) {
        console.error("Lỗi quá trình thực thi:", error.message);
        process.exit(1);
    }
}

importUsers();
