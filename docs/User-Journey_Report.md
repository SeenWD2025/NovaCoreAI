# First Attempt at a User Journey (Stage 1)

## Registration 
    -New user registered successfully (email:bizpro96@gmail.com ; pwd: Business9616)
    -Verifiation failed to send. Attempted to resend email verification manually and it also failed.
    -Password recreation printed success, but upon attempting to sign in it was revealed the new password did not work, the old one oes not work either. Locked out
    -Missing password reset option. 
    -Session Management: logout of all sessions worked successfully.
    -Login with credentials from registration was unsuccessful

## Dashboard
    -Page loaded successfully
    -Achievements page link worked as expected (but progress page failed to load)
    -All buttons worked

## Profile
    -Page loaded successfully
    -Missing profile photo upload functionality
    -"user type" badge is not readable (student, light grey bg, whit font. needs contrast)
    -Subscription tab: buttons to select a plan are not functional
    -Notifications tab: Preferences do not update/save changes
    -Contact Support Container: Contact Support is not functional/no action

## Progress
    -Page fails to load. Attempts to load indefinately without time-out

## Levels
    -Page loads successfully
    -1 level unlocked by default but unable to select or start the lesson

## Memory
    -Page loads successfully
    -Chat is not functional and without chat functionality no memories are created. 
    -missing dependancy (chat) to test functionality

## Chat
    -Page loads successfully
    -Message sends successfully
    -Fall back response "Sorry, I encountered an error"
    -Missing functionality (should call ollama to get mistral 7B instruct q4 LLM responses)

## Leaderboard
    -Page loads successfully
    -No working data to load yet need more functional core features first
    -Buttons to "continue learning" not functional.