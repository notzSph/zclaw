package ai.jayzoo.app.ui

import ai.jayzoo.app.MainViewModel
import ai.jayzoo.app.ui.chat.ChatSheetContent
import androidx.compose.runtime.Composable

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
